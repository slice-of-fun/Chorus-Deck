import type { AudioOutputDevice } from '@/types/audio';
import type { SongResult } from '@/types/music';
import { getImgUrl, isDesktop } from '@/utils';

class AudioService {
  private audio: HTMLAudioElement;
  private currentTrack: SongResult | null = null;

  private context: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private bassBoostNode: BiquadFilterNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private gainNode: GainNode | null = null;
  private bypass = false;

  private playbackRate = 1.0;
  private currentSinkId: string = 'default';
  private _isLoading = false;

  private operationLock = false;
  private operationLockTimer: ReturnType<typeof setTimeout> | null = null;

  private pendingLoadCleanup: (() => void) | null = null;

  private readonly frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  private defaultEQSettings: { [key: string]: number } = {
    '31': 0,
    '62': 0,
    '125': 0,
    '250': 0,
    '500': 0,
    '1000': 0,
    '2000': 0,
    '4000': 0,
    '8000': 0,
    '16000': 0
  };

  private callbacks: { [key: string]: Function[] } = {};

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';

    this.bindAudioEvents();

    if ('mediaSession' in navigator) {
      this.initMediaSession();
    }

    const bypassState = localStorage.getItem('eqBypass');
    this.bypass = bypassState ? JSON.parse(bypassState) : false;

    this.forceResetOperationLock();
    window.addEventListener('beforeunload', () => this.forceResetOperationLock());
  }

  private bindAudioEvents() {
    this.audio.addEventListener('play', () => {
      this.updateMediaSessionState(true);
      this.emit('');
    });

    this.audio.addEventListener('pause', () => {
      this.updateMediaSessionState(false);
      this.emit('');
    });

    this.audio.addEventListener('ended', () => {
      this.emit('');
    });

    this.audio.addEventListener('seeked', () => {
      this.updateMediaSessionPositionState();
      this.emit('');
    });

    this.audio.addEventListener('timeupdate', () => {});

    this.audio.addEventListener('waiting', () => {
      this._isLoading = true;
    });

    this.audio.addEventListener('canplay', () => {
      this._isLoading = false;
    });

    this.audio.addEventListener('error', () => {
      const error = this.audio.error;
      console.error('Audio element error:', error?.code, error?.message);
      this.emit('audio_error', { type: 'media_error', error });
    });
  }

  private initMediaSession() {
    navigator.mediaSession.setActionHandler('play', () => {
      this.audio.play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.audio.pause();
    });

    navigator.mediaSession.setActionHandler('stop', () => {
      this.stop();
    });

    navigator.mediaSession.setActionHandler('seekto', (event) => {
      if (event.seekTime !== undefined) {
        this.seek(event.seekTime);
      }
    });

    navigator.mediaSession.setActionHandler('seekbackward', (event) => {
      this.seek(this.audio.currentTime - (event.seekOffset || 10));
    });

    navigator.mediaSession.setActionHandler('seekforward', (event) => {
      this.seek(this.audio.currentTime + (event.seekOffset || 10));
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      this.emit('');
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      this.emit('');
    });
  }

  private updateMediaSessionMetadata(track: SongResult) {
    try {
      if (!('mediaSession' in navigator)) return;

      const artists = track.ar
        ? track.ar.map((a) => a.name)
        : track.artists?.map((a) => a.name);
      const album = track.al ? track.al.name : track.album;

      const artwork = ['96', '128', '192', '256', '384', '512', '1024'].map((size) => ({
        src: getImgUrl(track.picUrl, `${size}y${size}`),
        type: 'image/jpg',
        sizes: `${size}x${size}`
      }));

      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.name || '',
        artist: artists ? artists.join(',') : '',
        album: album || '',
        artwork
      });
    } catch (error) {
      console.error('Error updating media session metadata:', error);
    }
  }

  private updateMediaSessionState(isPlaying: boolean) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    this.updateMediaSessionPositionState();
  }

  private updateMediaSessionPositionState() {
    try {
      if (!('mediaSession' in navigator)) return;
      if (!this.audio.duration || !isFinite(this.audio.duration)) return;

      if ('setPositionState' in navigator.mediaSession) {
        navigator.mediaSession.setPositionState({
          duration: this.audio.duration,
          playbackRate: this.playbackRate,
          position: this.audio.currentTime
        });
      }
    } catch (error) {
      console.error('Error updating media session location status:', error);
    }
  }

  private emit(event: string, ...args: any[]) {
    const eventCallbacks = this.callbacks[event];
    if (eventCallbacks) {
      eventCallbacks.forEach((callback) => callback(...args));
    }
  }

  on(event: string, callback: Function) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  off(event: string, callback: Function) {
    const eventCallbacks = this.callbacks[event];
    if (eventCallbacks) {
      this.callbacks[event] = eventCallbacks.filter((cb) => cb !== callback);
    }
  }

  clearAllListeners() {
    this.callbacks = {};
  }

  private setupEQ() {
    if (this.sourceNode) return;

    if (!isDesktop()) {
      console.log('WebSkip in environmentEQset, avoidCORSquestion');
      this.bypass = true;
      return;
    }

    try {
      this.context = new AudioContext();
      this.sourceNode = this.context.createMediaElementSource(this.audio);
      this.gainNode = this.context.createGain();

      const savedSettings = this.loadEQSettings();
      this.filters = this.frequencies.map((freq) => {
        const filter = this.context!.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1;
        filter.gain.value = savedSettings[freq.toString()] || 0;
        return filter;
      });

      this.bassBoostNode = this.context.createBiquadFilter();
      this.bassBoostNode.type = 'lowshelf';
      this.bassBoostNode.frequency.value = 100;
      this.bassBoostNode.gain.value = 0;

      this.pannerNode = this.context.createStereoPanner();
      this.pannerNode.pan.value = 0;

      this.applyBypassState();

      const savedVolume = localStorage.getItem('volume');
      this.applyVolume(savedVolume ? parseFloat(savedVolume) : 1);

      this.setupContextStateMonitoring();

      this.restoreSavedAudioDevice();

      console.log('EQ initialization successful');
    } catch (error) {
      console.error('EQ initialization failed:', error);

      this.sourceNode = null;
      this.context = null;
    }
  }

  private applyBypassState() {
    if (!this.sourceNode || !this.gainNode || !this.context) return;

    try {
      try {
        this.sourceNode.disconnect();
      } catch { /* empty */ }
      this.filters.forEach((filter) => {
        try {
          filter.disconnect();
        } catch { /* empty */ }
      });
      try {
        this.gainNode.disconnect();
      } catch { /* empty */ }

      if (this.bypass) {
        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.context.destination);
      } else {
        const appSettingsStr = localStorage.getItem('appSettings');
        const appSettings = appSettingsStr ? JSON.parse(appSettingsStr) : {};

        // Apply DSP Settings
        if (this.bassBoostNode) {
          const bassBoostVal = appSettings.bassBoost ? appSettings.bassBoost / 1000 : 0;
          this.bassBoostNode.gain.value = bassBoostVal * 15; // up to 15dB boost
        }
        
        const currentNode: AudioNode = this.sourceNode;

        currentNode.connect(this.filters[0]);
        this.filters.forEach((filter, index) => {
          if (index < this.filters.length - 1) {
            filter.connect(this.filters[index + 1]);
          }
        });
        
        const lastEqNode = this.filters[this.filters.length - 1];
        
        if (this.bassBoostNode && this.pannerNode) {
            lastEqNode.connect(this.bassBoostNode);
            this.bassBoostNode.connect(this.pannerNode);
            this.pannerNode.connect(this.gainNode);
        } else {
            lastEqNode.connect(this.gainNode);
        }

        this.gainNode.connect(this.context.destination);
      }
    } catch (error) {
      console.error('Error applying EQ state, attempting fallback:', error);
      try {
        if (this.sourceNode && this.context) {
          this.sourceNode.connect(this.context.destination);
        }
      } catch (fallbackError) {
        console.error('Fallback connection also failed:', fallbackError);
        this.emit('audio_error', { type: 'graph_disconnected', error: fallbackError });
      }
    }
  }

  public isEQEnabled(): boolean {
    return !this.bypass;
  }

  public setEQEnabled(enabled: boolean) {
    this.bypass = !enabled;
    localStorage.setItem('eqBypass', JSON.stringify(this.bypass));

    if (this.sourceNode && this.gainNode && this.context) {
      this.applyBypassState();
    }
  }

  public setEQFrequencyGain(frequency: string, gain: number) {
    const filterIndex = this.frequencies.findIndex((f) => f.toString() === frequency);
    if (filterIndex !== -1 && this.filters[filterIndex]) {
      this.filters[filterIndex].gain.setValueAtTime(gain, this.context?.currentTime || 0);
      this.saveEQSettings(frequency, gain);
    }
  }

  public resetEQ() {
    this.filters.forEach((filter) => {
      filter.gain.setValueAtTime(0, this.context?.currentTime || 0);
    });
    localStorage.removeItem('eqSettings');
  }

  public getAllEQSettings(): { [key: string]: number } {
    return this.loadEQSettings();
  }

  public getCurrentPreset(): string | null {
    return localStorage.getItem('currentPreset');
  }

  public setCurrentPreset(preset: string): void {
    localStorage.setItem('currentPreset', preset);
  }

  private saveEQSettings(frequency: string, gain: number) {
    const settings = this.loadEQSettings();
    settings[frequency] = gain;
    localStorage.setItem('eqSettings', JSON.stringify(settings));
  }

  private loadEQSettings(): { [key: string]: number } {
    const savedSettings = localStorage.getItem('eqSettings');
    return savedSettings ? JSON.parse(savedSettings) : { ...this.defaultEQSettings };
  }

  private setOperationLock(): boolean {
    if (this.operationLock) {
      return false;
    }
    this.operationLock = true;

    if (this.operationLockTimer) clearTimeout(this.operationLockTimer);
    this.operationLockTimer = setTimeout(() => {
      console.warn('Automatic release of operation lock upon timeout');
      this.releaseOperationLock();
    }, 5000);

    return true;
  }

  public releaseOperationLock(): void {
    this.operationLock = false;
    if (this.operationLockTimer) {
      clearTimeout(this.operationLockTimer);
      this.operationLockTimer = null;
    }
  }

  public forceResetOperationLock(): void {
    this.operationLock = false;
    if (this.operationLockTimer) {
      clearTimeout(this.operationLockTimer);
      this.operationLockTimer = null;
    }
  }

  public play(
    url: string,
    track: SongResult,
    isPlay: boolean = true,
    seekTime: number = 0,
    _existingSound?: HTMLAudioElement
  ): Promise<HTMLAudioElement> {
    if (this.audio.src && !url && !track) {
      this.audio.play();
      return Promise.resolve(this.audio);
    }

    this.forceResetOperationLock();
    this.setOperationLock();

    if (!url || !track) {
      this.releaseOperationLock();
      return Promise.reject(new Error('Missing required parameters: urlandtrack'));
    }

    const currentSrc = this.audio.src;
    const isSameUrl = currentSrc && currentSrc === url;

    if (isSameUrl) {
      this.currentTrack = track;
      if (seekTime > 0) this.audio.currentTime = seekTime;
      if (isPlay) this.audio.play();
      this.updateMediaSessionMetadata(track);
      this.releaseOperationLock();
      return Promise.resolve(this.audio);
    }

    if (this.pendingLoadCleanup) {
      this.pendingLoadCleanup();
      this.pendingLoadCleanup = null;
    }

    return new Promise<HTMLAudioElement>((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 1;

      const tryPlay = () => {
        this._isLoading = true;
        this.currentTrack = track;

        this.setupEQ();

        if (this.context && this.context.state === 'suspended') {
          this.context.resume().catch((e) => console.warn('Failed to resume AudioContext:', e));
        }

        const onCanPlay = () => {
          cleanup();
          this._isLoading = false;

          if (seekTime > 0) {
            this.audio.currentTime = seekTime;
          }

          if (isPlay) {
            this.audio.play().catch((err) => {
              console.error('Audio play failed:', err);
              this.emit('playerror', { track, error: err });
            });
          }

          const savedVolume = localStorage.getItem('volume');
          this.applyVolume(savedVolume ? parseFloat(savedVolume) : 1);

          this.audio.playbackRate = this.playbackRate;
          this.updateMediaSessionMetadata(track);
          this.updateMediaSessionPositionState();
          this.emit('');
          this.releaseOperationLock();
          resolve(this.audio);
        };

        const onError = () => {
          cleanup();
          this._isLoading = false;
          const error = this.audio.error;
          console.error('Audio load error:', error?.code, error?.message);
          this.emit('loaderror', { track, error });

          const isSrcNotSupported = error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED;

          if (!isSrcNotSupported && retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying playback (${retryCount}/${maxRetries})...`);
            setTimeout(tryPlay, 1000 * retryCount);
          } else {
            this.emit('url_expired', track);
            this.releaseOperationLock();
            reject(new Error('Audio loading failed, please try switching to other songs'));
          }
        };

        const cleanup = () => {
          this.audio.removeEventListener('canplay', onCanPlay);
          this.audio.removeEventListener('error', onError);
          if (this.pendingLoadCleanup === cleanup) {
            this.pendingLoadCleanup = null;
          }
        };

        this.pendingLoadCleanup = cleanup;

        this.audio.addEventListener('canplay', onCanPlay, { once: true });
        this.audio.addEventListener('error', onError, { once: true });

        this.audio.src = url;
        this.audio.load();
      };

      tryPlay();
    }).finally(() => {
      this.releaseOperationLock();
    });
  }

  public pause() {
    this.forceResetOperationLock();
    try {
      this.audio.pause();
    } catch (error) {
      console.error('Failed to pause audio:', error);
    }
  }

  public stop() {
    this.forceResetOperationLock();

    if (this.pendingLoadCleanup) {
      this.pendingLoadCleanup();
      this.pendingLoadCleanup = null;
    }
    try {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    } catch (error) {
      console.error('Failed to stop audio:', error);
    }
    this.currentTrack = null;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  }

  public seek(time: number) {
    this.forceResetOperationLock();
    try {
      this.emit('seek_start', time);
      this.audio.currentTime = Math.max(0, time);
      this.updateMediaSessionPositionState();
    } catch (error) {
      console.error('SeekOperation failed:', error);
    }
  }

  public setVolume(volume: number) {
    this.applyVolume(volume);
  }

  private applyVolume(volume: number) {
    const normalizedVolume = Math.max(0, Math.min(1, volume));

    if (this.gainNode && this.context) {
      this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
      this.gainNode.gain.setValueAtTime(normalizedVolume, this.context.currentTime);
    } else {
      this.audio.volume = normalizedVolume;
    }

    localStorage.setItem('volume', normalizedVolume.toString());
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    this.audio.playbackRate = rate;
    this.updateMediaSessionPositionState();
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  getCurrentSound(): HTMLAudioElement | null {
    return this.audio.src ? this.audio : null;
  }

  getCurrentTrack(): SongResult | null {
    return this.currentTrack;
  }

  isLoading(): boolean {
    return this._isLoading || this.operationLock;
  }

  isActuallyPlaying(): boolean {
    if (!this.audio.src) return false;
    try {
      const isPlaying = !this.audio.paused && !this.audio.ended;
      const contextOk = !this.context || this.context.state === 'running';
      return isPlaying && !this._isLoading && contextOk;
    } catch (error) {
      console.error('Error checking playback status:', error);
      return false;
    }
  }

  public async getAudioOutputDevices(): Promise<AudioOutputDevice[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

      return audioOutputs.map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Speaker ${index + 1}`,
        isDefault: device.deviceId === 'default' || device.deviceId === ''
      }));
    } catch (error) {
      console.error('Failed to enumerate audio devices:', error);
      return [{ deviceId: 'default', label: 'Default', isDefault: true }];
    }
  }

  public async setAudioOutputDevice(deviceId: string): Promise<boolean> {
    try {
      if (this.context && typeof (this.context as any).setSinkId === 'function') {
        await (this.context as any).setSinkId(deviceId);
        this.currentSinkId = deviceId;
        localStorage.setItem('audioOutputDeviceId', deviceId);
        console.log('Audio output device switched:', deviceId);
        return true;
      } else {
        console.warn('AudioContext.setSinkId Not available');
        return false;
      }
    } catch (error) {
      console.error('Failed to set audio output device:', error);
      return false;
    }
  }

  public getCurrentSinkId(): string {
    return this.currentSinkId;
  }

  private async restoreSavedAudioDevice(): Promise<void> {
    const savedDeviceId = localStorage.getItem('audioOutputDeviceId');
    if (savedDeviceId && savedDeviceId !== 'default') {
      try {
        await this.setAudioOutputDevice(savedDeviceId);
      } catch (error) {
        console.warn('Failed to restore audio output device and fell back to default device:', error);
        localStorage.removeItem('audioOutputDeviceId');
        this.currentSinkId = 'default';
      }
    }
  }

  private setupContextStateMonitoring() {
    if (!this.context) return;

    this.context.addEventListener('statechange', async () => {
      console.log('AudioContext state changed:', this.context?.state);

      if (this.context?.state === 'suspended' && !this.audio.paused) {
        console.log('AudioContext suspended while playing, attempting to resume...');
        try {
          await this.context.resume();
          console.log('AudioContext resumed successfully');
        } catch (e) {
          console.error('Failed to resume AudioContext:', e);
          this.emit('audio_error', { type: 'context_suspended', error: e });
        }
      } else if (this.context?.state === 'closed') {
        console.warn('AudioContext was closed unexpectedly');
        this.emit('audio_error', { type: 'context_closed' });
      }
    });
  }
}

export const audioService = new AudioService();
