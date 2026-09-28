import { ipcMain, BrowserWindow, net } from 'electron';
import { getStore } from './config';
import WebSocket from 'ws';

export class DiscordPresenceManager {
  private ws: WebSocket | null = null;
  private isReady = false;
  private currentActivity: any = null;
  private token = '';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private seq: number | null = null;
  private sessionId = '';
  private clientId = '';

  constructor() {
    const store = getStore();
    this.token = (store.get('set.discordToken') as string) || '';
    this.clientId = (store.get('set.discordClientId') as string) || '1554131750899163186';
    if (this.token) {
      this.initGateway();
    }
    this.setupIPC();
  }

  private initGateway(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanup();
      
      this.ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');

      this.ws.on('open', () => {
        console.log('Discord Gateway connected');
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

  private setupIPC() {
    ipcMain.handle('discord-webview-login', async () => {
      return new Promise((resolve, reject) => {
        const win = new BrowserWindow({
          width: 800,
          height: 700,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            partition: 'discord-login' // non-persistent: fresh session every time, no shared cookies
          }
        });

        win.setMenuBarVisibility(false);
        // Spoof user agent to avoid Discord blocking Electron
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        win.loadURL('https://discord.com/login', { userAgent });

        let isResolved = false;
        
        const checkToken = async () => {
          if (win.isDestroyed()) return;
          
          const currentUrl = win.webContents.getURL();
          // Wait until user actually logs in and gets redirected
          if (currentUrl.includes('/login')) return;

          try {
            const token = await win.webContents.executeJavaScript(`
              (() => {
                try {
                  // Fallback: check localStorage directly first
                  let t = window.localStorage.getItem('token');
                  if (t) return t.replace(/"/g, '');
                  
                  // Webpack chunk method to get token
                  let token = null;
                  const req = window.webpackChunkdiscord_app?.push([[Math.random()], {}, (r) => r]);
                  if (req) {
                    for (const m of Object.keys(req.c).map(x => req.c[x].exports).filter(x => x)) {
                      if (m.default && m.default.getToken !== undefined) {
                        token = m.default.getToken();
                        break;
                      }
                      if (m.getToken !== undefined) {
                        token = m.getToken();
                        break;
                      }
                    }
                  }
                  return token;
                } catch(e) {
                  return null;
                }
              })()
            `);

            if (token) {
              isResolved = true;
              clearInterval(interval);
              
              this.token = token;
              const store = getStore();
              store.set('set.discordToken', token);
              
              this.initGateway().catch(console.error);

              // Fetch real user info from Discord API
              let userInfo = { token, username: '', name: '', avatarUrl: '' };
              try {
                const user = await this.fetchDiscordUser(token);
                if (user) {
                  userInfo.username = user.username;
                  userInfo.name = user.global_name || user.username;
                  userInfo.avatarUrl = user.avatar
                    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
                    : '';
                  // Persist user info
                  store.set('set.discordUsername', userInfo.username);
                  store.set('set.discordName', userInfo.name);
                  store.set('set.discordAvatarUrl', userInfo.avatarUrl);
                }
              } catch (e) {
                console.error('Failed to fetch Discord user info:', e);
              }
              
              resolve(userInfo);
              
              if (!win.isDestroyed()) {
                win.close();
              }
            }
          } catch (e) {
            // Ignore execution errors
          }
        };

        const interval = setInterval(checkToken, 1000);

        win.on('closed', () => {
          clearInterval(interval);
          if (!isResolved) {
            reject(new Error('Window closed before login'));
          }
        });
      });
    });

    ipcMain.on('discord-logout', () => {
      this.token = '';
      const store = getStore();
      store.set('set.discordToken', '');
      this.destroy();
    });

    ipcMain.on('update-discord-presence', (_event, presenceData) => {
      console.log('Received update-discord-presence event:', presenceData);
      this.currentActivity = this.formatActivity(presenceData);
      console.log('Formatted activity:', this.currentActivity);
      if (this.isReady && this.ws) {
        this.setActivity(this.currentActivity);
      } else {
        console.log('RPC not ready or not initialized');
      }
    });

    ipcMain.on('clear-discord-presence', () => {
      this.currentActivity = null;
      if (this.isReady && this.ws) {
        this.setActivity(null);
      }
    });
  }

  private formatActivity(data: any): any {
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

  private setActivity(activity: any) {
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

  public destroy() {
    this.cleanup();
  }

  private fetchDiscordUser(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = net.request({
        method: 'GET',
        url: 'https://discord.com/api/v9/users/@me',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      let body = '';
      request.on('response', (response) => {
        response.on('data', (chunk) => { body += chunk.toString(); });
        response.on('end', () => {
          try {
            const user = JSON.parse(body);
            if (user && user.id) {
              resolve(user);
            } else {
              reject(new Error('Invalid user response: ' + body));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      request.on('error', reject);
      request.end();
    });
  }
}

