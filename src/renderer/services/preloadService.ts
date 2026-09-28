import type { SongResult } from '@/types/music';

class PreloadService {
  private validatedUrls: Map<string | number, string> = new Map();
  private loadingPromises: Map<string | number, Promise<string>> = new Map();

  private static readonly MAX_VALIDATED_URLS = 100;

  public async load(song: SongResult): Promise<string> {
    if (!song || !song.id) {
      throw new Error('Invalid song object');
    }

    if (!song.playMusicUrl) {
      throw new Error('Song no URL');
    }

    if (this.validatedUrls.has(song.id)) {
      console.log(`[PreloadService] song ${song.name} URL Verified, use directly`);
      return this.validatedUrls.get(song.id)!;
    }

    if (this.loadingPromises.has(song.id)) {
      console.log(`[PreloadService] song ${song.name} Verifying, reusing existing request`);
      return this.loadingPromises.get(song.id)!;
    }

    console.log(`[PreloadService] Start verifying songs: ${song.name}`);

    const url = song.playMusicUrl;
    const loadPromise = this._validate(url, song);
    this.loadingPromises.set(song.id, loadPromise);

    try {
      const validatedUrl = await loadPromise;
      this.validatedUrls.set(song.id, validatedUrl);

      if (this.validatedUrls.size > PreloadService.MAX_VALIDATED_URLS) {
        const oldestKey = this.validatedUrls.keys().next().value;
        if (oldestKey !== undefined) {
          this.validatedUrls.delete(oldestKey);
        }
      }
      return validatedUrl;
    } finally {
      this.loadingPromises.delete(song.id);
    }
  }

  private async _validate(url: string, song: SongResult): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const testAudio = new Audio();
      testAudio.crossOrigin = 'anonymous';
      testAudio.preload = 'metadata';

      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        testAudio.removeEventListener('loadedmetadata', onLoaded);
        testAudio.removeEventListener('error', onError);
        testAudio.src = '';
        testAudio.load();
      };

      const onLoaded = () => {
        const duration = testAudio.duration;
        const expectedDuration = (song.dt || 0) / 1000;

        if (expectedDuration > 0 && duration > 0 && isFinite(duration)) {
          const durationDiff = Math.abs(duration - expectedDuration);
          if (duration < expectedDuration * 0.5 && durationDiff > 10) {
            console.warn(
              `[PreloadService] Severely Inadequate Duration: Actual ${duration.toFixed(1)}s, expected ${expectedDuration.toFixed(1)}s (${song.name}), possibly a trial version`
            );
            window.dispatchEvent(
              new CustomEvent('audio-duration-mismatch', {
                detail: {
                  songId: song.id,
                  songName: song.name,
                  actualDuration: duration,
                  expectedDuration
                }
              })
            );
          }
        }

        cleanup();
        resolve(url);
      };

      const onError = () => {
        cleanup();
        reject(new Error(`URL Authentication failed: ${song.name}`));
      };

      testAudio.addEventListener('loadedmetadata', onLoaded);
      testAudio.addEventListener('error', onError);
      testAudio.src = url;
      testAudio.load();

      timeoutId = setTimeout(() => {
        cleanup();

        resolve(url);
      }, 3000);
    });
  }

  public consume(songId: string | number): string | undefined {
    const url = this.validatedUrls.get(songId);
    if (url) {
      this.validatedUrls.delete(songId);
      console.log(`[PreloadService] Consume pre-verified songs: ${songId}`);
      return url;
    }
    return undefined;
  }

  public cancel(songId: string | number) {
    this.validatedUrls.delete(songId);
  }

  public getPreloadedSound(songId: string | number): string | undefined {
    return this.validatedUrls.get(songId);
  }

  public clearAll() {
    this.validatedUrls.clear();
    this.loadingPromises.clear();
  }
}

export const preloadService = new PreloadService();
