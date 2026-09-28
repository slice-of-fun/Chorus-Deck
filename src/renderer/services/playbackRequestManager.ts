import type { SongResult } from '@/types/music';

class PlaybackRequestManager {
  private currentRequestId: string | null = null;
  private counter = 0;

  createRequest(song: SongResult): string {
    const requestId = `req_${Date.now()}_${++this.counter}`;
    this.currentRequestId = requestId;
    console.log(`[RequestManager] new request: ${requestId}, song: ${song.name}`);
    return requestId;
  }

  isRequestValid(requestId: string): boolean {
    return this.currentRequestId === requestId;
  }

  activateRequest(requestId: string): boolean {
    return this.isRequestValid(requestId);
  }

  completeRequest(requestId: string): void {
    console.log(`[RequestManager] Finish: ${requestId}`);
  }

  failRequest(requestId: string): void {
    console.log(`[RequestManager] fail: ${requestId}`);
  }

  getCurrentRequestId(): string | null {
    return this.currentRequestId;
  }
}

export const playbackRequestManager = new PlaybackRequestManager();
