import type { AudioOutputDevice } from '@/types/audio';
import type { SongResult } from '@/types/music';
import { getImgUrl, isDesktop } from '@/utils';

class AudioService {
  private currentTrack: SongResult | null = null;

  private bypass = false;

  private playbackRate = 1.0;
  private currentSinkId: string = 'default';
  private _isLoading = false;
  private _isPlayingNative = false;
  private currentUrl: string | null = null;
  private _currentNativeDuration: number | null = null;

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
    window.api.onPlaybackProgress((timeSecs: number) => {
      this.emit('timeupdate', timeSecs);
    });
    window.api.onPlaybackEnded(() => {
      this._isPlayingNative = false;
      this.emit('end');
    });
  }

  private initMediaSession() {
    navigator.mediaSession.setActionHandler('play', () => {
      window.api.audioResume();
      this._isPlayingNative = true;
      this.updateMediaSessionState(true);
      this.emit('play');
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.pause();
    });

    navigator.mediaSession.setActionHandler('stop', () => {
      this.stop();
    });

    navigator.mediaSession.setActionHandler('seekto', (event) => {
      if (event.seekTime !== undefined) {
        this.seek(event.seekTime);
      }
    });

    navigator.mediaSession.setActionHandler('seekbackward', async (event) => {
      try {
        const currentTime = await window.api.audioGetTime();
        const offset = event.seekOffset || 10;
        this.seek(Math.max(0, currentTime - offset));
      } catch (err) {
        console.error('Error seeking backward:', err);
      }
    });

    navigator.mediaSession.setActionHandler('seekforward', async (event) => {
      try {
        const currentTime = await window.api.audioGetTime();
        const offset = event.seekOffset || 10;
        const duration = this.getDuration();
        this.seek(Math.min(duration, currentTime + offset));
      } catch (err) {
        console.error('Error seeking forward:', err);
      }
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      this.emit('previoustrack');
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      this.emit('nexttrack');
    });
  }

  private updateMediaSessionMetadata(track: SongResult) {
    try {
      if (!('mediaSession' in navigator)) return;

      const artists = track.ar ? track.ar.map((a) => a.name) : track.artists?.map((a) => a.name);
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

  private async updateMediaSessionPositionState() {
    try {
      if (!('mediaSession' in navigator)) return;
      if ('setPositionState' in navigator.mediaSession) {
        const position = await window.api.audioGetTime();
        const duration = this.getDuration();

        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
          playbackRate: this.playbackRate,
          position: Math.max(0, Math.min(position, duration))
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
    this.bypass = false;
    window.api.audioSetEqBypass(this.bypass);
  }

  private applyBypassState() {
    window.api.audioSetEqBypass(this.bypass);
  }

  public isEQEnabled(): boolean {
    return !this.bypass;
  }

  public setEQEnabled(enabled: boolean) {
    this.bypass = !enabled;
    localStorage.setItem('eqBypass', JSON.stringify(this.bypass));
  }

  public setEQFrequencyGain(frequency: string, gain: number) {
    this.saveEQSettings(frequency, gain);
    window.api.audioSetEqBand(parseFloat(frequency), gain);
  }

  public resetEQ() {
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
  ): Promise<void> {
    if (this.currentUrl && !url && !track) {
      window.api.audioResume();
      this._isPlayingNative = true;
      this.updateMediaSessionState(true);
      this.emit('play');
      return Promise.resolve();
    }

    this.forceResetOperationLock();
    this.setOperationLock();

    if (!url || !track) {
      this.releaseOperationLock();
      return Promise.reject(new Error('Missing required parameters: urlandtrack'));
    }

    const isSameUrl = this.currentUrl === url;

    if (isSameUrl) {
      this.currentTrack = track;
      if (isPlay) {
        window.api.audioResume();
        this._isPlayingNative = true;
        this.updateMediaSessionState(true);
      }
      this.updateMediaSessionMetadata(track);
      this.releaseOperationLock();
      return Promise.resolve();
    }

    if (this.pendingLoadCleanup) {
      this.pendingLoadCleanup();
      this.pendingLoadCleanup = null;
    }

    return new Promise<void>((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 1;

      const tryPlay = async () => {
        this._isLoading = true;
        this.currentTrack = track;

        try {
          if (isPlay) {
            // Hand the known duration to the native side so it never has to
            // seek to the end of the HTTP stream just to measure it.
            const rawDur = track.dt || track.duration || 0;
            const durationMs = rawDur > 1000 ? rawDur : rawDur * 1000;
            // The resolved stream carries the real container (e.g. `audio/mp4`).
            // Passing it lets the native side pick a decoder that can actually
            // read these bytes instead of failing inside the probe.
            const container = track.mimeType || undefined;
            // Google's CDN rejects a download that does not impersonate the
            // InnerTube client which resolved the URL, and it answers 403 — the
            // same response an expired link gives, which is why this went
            // unnoticed for so long.
            const userAgent = track.streamUserAgent || undefined;
            await window.api.audioPlay(
              url,
              undefined,
              durationMs || undefined,
              container,
              userAgent
            );
            this._isPlayingNative = true;
            try {
              this._currentNativeDuration = await window.api.audioGetDuration();
            } catch (e) {
              console.warn('Failed to get native duration', e);
            }
            this.updateMediaSessionState(true);
          }
          this._isLoading = false;

          const savedVolume = localStorage.getItem('volume');
          this.applyVolume(savedVolume ? parseFloat(savedVolume) : 1);

          this.currentUrl = url;

          this.updateMediaSessionMetadata(track);
          this.emit('play');
          this.releaseOperationLock();
          resolve(undefined as any);
        } catch (err) {
          this._isLoading = false;
          console.error('Audio play failed:', err);
          this.emit('playerror', { track, error: err });

          // A retry reuses the same URL, so retrying a URL the CDN already
          // refused just burns a second and produces the identical failure. A
          // rejected URL is unrecoverable without resolving a fresh one, which
          // is what the `url_expired` path does.
          const message = err instanceof Error ? err.message : String(err ?? '');
          const urlRejected = /status 40[13]|403 Forbidden|429 Too Many/i.test(message);

          if (urlRejected) {
            console.warn(
              '[audioService] resolved URL was refused by the CDN; skipping retry and re-resolving'
            );
            // Mark the URL so the store stops handing back the same dead link on
            // a later lookup. The recovery path clears both the marker and the
            // URL together when it re-resolves.
            this.markUrlRejected(track);
            this.emit('url_expired', track);
            this.releaseOperationLock();
            reject(new Error('Stream URL was refused by the server, re-resolving'));
            return;
          }

          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying playback (${retryCount}/${maxRetries})...`);
            setTimeout(tryPlay, 1000 * retryCount);
          } else {
            this.emit('url_expired', track);
            this.releaseOperationLock();
            reject(new Error('Audio loading failed, please try switching to other songs'));
          }
        }
      };

      tryPlay();
    }).finally(() => {
      this.releaseOperationLock();
    });
  }

  private markUrlRejected(track: SongResult) {
    const rejected = { ...track, urlRejectedAt: Date.now() };
    this.currentTrack = rejected;

    void (async () => {
      try {
        const { usePlayerCoreStore } = await import('@/store/modules/playerCore');
        const playerCore = usePlayerCoreStore();

        if (playerCore.playMusic?.id !== track.id) return;

        playerCore.playMusic.urlRejectedAt = rejected.urlRejectedAt;
        playerCore.playMusic.playMusicUrl = undefined;
        playerCore.playMusic.mimeType = undefined;
        playerCore.playMusic.streamUserAgent = undefined;
        playerCore.playMusicUrl = '';
      } catch (error) {
        console.warn('[audioService] could not record the rejected URL:', error);
      }
    })();
  }

  public pause() {
    this.forceResetOperationLock();
    try {
      window.api.audioPause();
      this._isPlayingNative = false;
      this.updateMediaSessionState(false);
      this.emit('pause');
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
      window.api.audioStop();
      this._isPlayingNative = false;
      this.updateMediaSessionState(false);
      this.emit('stop');
      this.currentUrl = null;
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
      window.api.audioSeek(time);
      this.emit('seek_start', time);
      this.emit('seek', time);
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

    window.api.audioSetVolume(normalizedVolume);

    localStorage.setItem('volume', normalizedVolume.toString());
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    window.api.audioSetPlaybackRate(rate).catch((err: unknown) => {
      console.error('[audioService] Failed to set native playback rate:', err);
    });
    this.updateMediaSessionPositionState();
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  getDuration(): number {
    if (this._currentNativeDuration) return this._currentNativeDuration;
    if (!this.currentTrack) return 0;
    const rawDur = this.currentTrack.dt || this.currentTrack.duration || 0;
    return rawDur > 1000 ? rawDur / 1000 : rawDur;
  }

  getCurrentTrack(): SongResult | null {
    return this.currentTrack;
  }

  isLoading(): boolean {
    return this._isLoading || this.operationLock;
  }

  isActuallyPlaying(): boolean {
    if (!this.currentUrl && !this.currentTrack) return false;
    try {
      const isPlaying = this._isPlayingNative;
      return isPlaying && !this._isLoading;
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
      this.currentSinkId = deviceId;
      localStorage.setItem('audioOutputDeviceId', deviceId);
      return true;
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
        console.warn(
          'Failed to restore audio output device and fell back to default device:',
          error
        );
        localStorage.removeItem('audioOutputDeviceId');
        this.currentSinkId = 'default';
      }
    }
  }
}

export const audioService = new AudioService();
