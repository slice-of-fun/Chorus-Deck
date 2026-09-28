import { getStore } from './config';

export interface DiscordActivity {
  name: string;
  type: number; // 0=playing, 1=streaming, 2=listening, 3=watching, 5=competing
  details?: string;
  state?: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets: {
    large_image: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
}

export interface DiscordRPCSettings {
  enabled: boolean;
  clientId: string;
  showWhenPaused: boolean;
  activityDetails: 'ARTIST' | 'ALBUM' | 'SONG' | 'APP';
  activityState: 'ARTIST' | 'ALBUM' | 'SONG' | 'APP';
  largeImageType: 'thumbnail' | 'custom' | 'dontshow';
  largeImageCustomUrl: string;
  smallImageType: 'thumbnail' | 'custom' | 'dontshow';
  smallImageCustomUrl: string;
  activityType: 'PLAYING' | 'STREAMING' | 'LISTENING' | 'WATCHING' | 'COMPETING';
}

export class DiscordPresenceManager {
  private ws: WebSocket | null = null;
  private isReady = false;
  private currentActivity: DiscordActivity | null = null;
  private token = '';
  private clientId = '';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private seq: number | null = null;
  private sessionId = '';
  private readyResolve: ((() => void) | null) = null;

  constructor() {
    const store = getStore();
    this.token = (store.get('set.discordToken') as string) || '';
    this.clientId = (store.get('set.discordClientId') as string) || '1554131750899163186';

    if (this.token) {
      this.initGateway().catch(console.error);
    }
  }

  private initGateway(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanup();

      this.ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');

      this.ws.on('open', () => {
        console.log('Discord Gateway connected');
        this.identify();
        resolve();
      });

      this.ws.on('message', (data) => {
        const payload = JSON.parse(data.toString());
        if (payload.s !== null) this.seq = payload.s;

        if (payload.op === 10) { // Hello
          const interval = payload.d.heartbeat_interval;
          this.startHeartbeat(interval);
          this.identify();
          resolve();
        } else if (payload.op === 0 && payload.t === 'READY') {
          console.log('Discord Gateway READY');
          this.isReady = true;
          this.sessionId = payload.d.session_id;
          if (this.currentActivity) {
            this.setActivity(this.currentActivity);
          }
        }
      });

      this.ws.on('close', () => {
        console.log('Discord Gateway closed');
        this.cleanup();
      });

      this.ws.on('error', (err) => {
        console.error('Discord Gateway error:', err);
        reject(err);
      });
    });
  }

  private startHeartbeat(interval: number) {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 1, d: this.seq }));
      }
    }, interval);
  }

  private identify() {
    if (!this.ws || !this.token) return;

    const presence = this.currentActivity ? {
      status: 'online',
      since: 0,
      activities: [this.currentActivity],
      afk: false
    } : {
      status: 'online',
      since: 0,
      activities: [],
      afk: false
    };

    const payload = {
      op: 2,
      d: {
        token: this.token,
        properties: {
          os: 'windows',
          browser: 'Chorus Deck',
          device: 'pc'
        },
        ...(this.sessionId ? { session_id: this.sessionId } : {}),
        presence: presence
      }
    };
    this.ws.send(JSON.stringify(payload));
  }

  private cleanup() {
    this.isReady = false;
    this.seq = null;
    this.sessionId = '';
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // IPC handlers are now routed through the Tauri preload bridge
  // The preload at src/preload/index.ts exposes these functions via contextBridge.invoke:
  // - discord-webview-login -> api.discordWebviewLogin()
  // - discord-logout -> api.discordLogout()
  // - update-discord-presence(presenceData) -> api.updateDiscordPresence(presenceData)
  // - clear-discord-presence -> api.clearDiscordPresence()
  //
  // The actual implementations are in this module.

  setupIPC(): void {
    // IPC handler registration is now handled through the preload bridge
    // instead of direct ipcMain.handle/call
  }

  public updatePresence(presenceData: any): void {
    this.currentActivity = presenceData;
    if (this.isReady && this.ws) {
      this.setActivity(presenceData);
    } else {
      console.log('RPC not ready or not initialized');
    }
  }

  public clearPresence(): void {
    this.currentActivity = null;
    if (this.isReady && this.ws) {
      this.setActivity(null);
    }
  }

  private formatActivity(data: any): DiscordActivity | null {
    const store = getStore();
    const enabled = store.get('set.discordRPCEnabled');
    if (enabled === false) return null;

    const showWhenPaused = store.get('set.discordShowWhenPaused') || false;
    if (!data.isPlaying && !showWhenPaused) {
      return null;
    }

    const detailsPref = store.get('set.discordActivityDetails') || 'ARTIST';
    const statePref = store.get('set.discordActivityState') || 'ALBUM';

    const getSourceValue = (pref: unknown, defaultVal: string) => {
      switch (pref) {
        case 'ARTIST': return data.artist || defaultVal;
        case 'ALBUM': return data.album || defaultVal;
        case 'SONG': return data.title || defaultVal;
        case 'APP': return 'Chorus Deck';
        default: return defaultVal;
      }
    };

    const detailsText = getSourceValue(detailsPref, data.title || 'Chorus Deck').substring(0, 128);
    let stateText = getSourceValue(statePref, '').substring(0, 128);

    const largeImageType = store.get('set.discordLargeImageType') || 'thumbnail';
    const largeImageCustomUrl = store.get('set.discordLargeImageCustomUrl') || '';
    const smallImageType = store.get('set.discordSmallImageType') || 'dontshow';
    const smallImageCustomUrl = store.get('set.discordSmallImageCustomUrl') || '';

    let largeImageKey = 'chorus_logo';
    if (largeImageType === 'thumbnail') largeImageKey = data.albumArt || 'chorus_logo';
    else if (largeImageType === 'custom' && largeImageCustomUrl) largeImageKey = largeImageCustomUrl as string;

    let smallImageKey = '';
    if (smallImageType === 'thumbnail') smallImageKey = data.albumArt || 'chorus_logo';
    else if (smallImageType === 'custom' && smallImageCustomUrl) smallImageKey = smallImageCustomUrl as string;

    const largeImageText = getSourceValue('ALBUM', data.album || data.title).substring(0, 128);
    const smallImageText = data.isPlaying ? `Playing ${data.title} from Chorus Deck`.substring(0, 128) : 'Paused';

    let endTimestamp;
    if (data.isPlaying && data.duration > 0 && data.startTimestamp) {
      endTimestamp = data.startTimestamp + data.duration;
    }

    const activityTypePref = store.get('set.discordActivityType') || 'LISTENING';
    let activityType = 2; // Default listening
    switch (activityTypePref) {
      case 'PLAYING': activityType = 0; break;
      case 'STREAMING': activityType = 1; break;
      case 'LISTENING': activityType = 2; break;
      case 'WATCHING': activityType = 3; break;
      case 'COMPETING': activityType = 5; break;
    }

    return {
      name: data.title || 'Chorus Deck',
      type: activityType,
      application_id: this.clientId,
      details: detailsText,
      state: stateText || undefined,
      timestamps: {
        start: data.startTimestamp ? Math.round(new Date(data.startTimestamp).getTime()) : undefined,
        end: endTimestamp ? Math.round(new Date(endTimestamp).getTime()) : undefined,
      },
      assets: {
        large_image: largeImageKey,
        large_text: largeImageText,
        small_image: smallImageKey || undefined,
        small_text: smallImageText,
      }
    };
  }

  private setActivity(activity: DiscordActivity): void {
    if (this.ws && this.isReady) {
      const presence = activity ? {
        status: 'online',
        since: 0,
        activities: [activity],
        afk: false
      } : {
        status: 'online',
        since: 0,
        activities: [],
        afk: false
      };

      this.ws.send(JSON.stringify({
        op: 3, // Presence Update
        d: presence
      }));
    }
  }

  public destroy(): void {
    this.cleanup();
  }

  private fetchDiscordUser(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Use fetch instead of net.request (Node.js built-in)
      fetch('https://discord.com/api/v9/users/@me', {
        method: 'GET',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
        .then(response => response.json())
        .then(user => {
          if (user && user.id) {
            resolve(user);
          } else {
            reject(new Error('Invalid user response'));
          }
        })
        .catch(reject);
    });
  }
}