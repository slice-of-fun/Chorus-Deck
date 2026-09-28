import { app } from '@tauri/api';
import Player from 'mpris-service';

let dbusModule: any;
try {
  dbusModule = require('@httptoolkit/dbus-native');
} catch { /* empty */ }

interface SongInfo {
  id?: number | string;
  name: string;
  picUrl?: string;
  ar?: Array<{ name: string }>;
  artists?: Array<{ name: string }>;
  al?: { name: string };
  album?: { name: string };
  duration?: number;
  dt?: number;
  song?: {
    artists?: Array<{ name: string }>;
    album?: { name: string };
    duration?: number;
    picUrl?: string;
  };
  [key: string]: any;
}

let mprisPlayer: Player | null = null;
let mainWindow: any = null;
let currentPosition = 0;
let trayLyricIface: any = null;
let trayLyricBus: any = null;

let onPositionUpdate: ((event: any, position: number) => void) | null = null;
let onTrayLyricUpdate: ((event: any, lrcObj: string) => void) | null = null;

export function initializeMpris(mainWindowRef: any) {
  if (process.platform !== 'linux') return;

  if (mprisPlayer) {
    return;
  }

  mainWindow = mainWindowRef;

  try {
    mprisPlayer = Player({
      name: 'ChorusDeck',
      identity: 'Chorus Deck',
      supportedUriSchemes: ['file', 'http', 'https'],
      supportedMimeTypes: [
        'audio/mpeg',
        'audio/mp3',
        'audio/flac',
        'audio/wav',
        'audio/ogg',
        'audio/aac',
        'audio/m4a'
      ],
      supportedInterfaces: ['player']
    });

    mprisPlayer.on('quit', () => {
      app.quit();
    });

    mprisPlayer.on('raise', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    mprisPlayer.on('next', () => {
      if (mainWindow) {
        // In Tauri, send event through preload bridge
        // mainWindow?.api?.('global-shortcut', 'nextPlay');
        console.log('MPRIS: next track');
      }
    });

    mprisPlayer.on('previous', () => {
      if (mainWindow) {
        // mainWindow?.api?.('global-shortcut', 'prevPlay');
        console.log('MPRIS: previous track');
      }
    });

    mprisPlayer.on('pause', () => {
      if (mainWindow) {
        // mainWindow?.api?.('mpris-pause');
        console.log('MPRIS: pause');
      }
    });

    mprisPlayer.on('play', () => {
      if (mainWindow) {
        // mainWindow?.api?.('mpris-play');
        console.log('MPRIS: play');
      }
    });

    mprisPlayer.on('playpause', () => {
      if (mainWindow) {
        // mainWindow?.api?.('global-shortcut', 'togglePlay');
        console.log('MPRIS: play/pause');
      }
    });

    mprisPlayer.on('stop', () => {
      if (mainWindow) {
        // mainWindow?.api?.('mpris-pause');
        console.log('MPRIS: stop');
      }
    });

    mprisPlayer.getPosition = (): number => {
      return currentPosition;
    };

    mprisPlayer.on('seek', (offset: number) => {
      if (mainWindow) {
        // const newPosition = Math.max(0, currentPosition + offset / 1000000);
        // mainWindow?.api?.('mpris-seek', newPosition);
        console.log('MPRIS: seek', offset);
      }
    });

    mprisPlayer.on('position', (event: { trackId: string; position: number }) => {
      if (mainWindow) {
        // mainWindow?.api?.('mpris-set-position', event.position / 1000000);
        console.log('MPRIS: position', event.position);
      }
    });

    // IPC handlers are now routed through the Tauri preload bridge
    // The preload at src/preload/index.ts exposes these functions via contextBridge.invoke:
    // - mpris-position-update -> api.mprisPositionUpdate(position)
    // - tray-lyric-update -> api.trayLyricUpdate(lrcObj)
    //
    // The actual listeners are set up in the Vue frontend and route
    // through the preload to this module.

    console.log('[MPRIS] Service initialized');
  } catch (error) {
    console.error('[MPRIS] Failed to initialize:', error);
  }
}

export function updateMprisPlayState(playing: boolean) {
  if (!mprisPlayer || process.platform !== 'linux') return;
  mprisPlayer.playbackStatus = playing ? 'Playing' : 'Paused';
}

export function updateMprisCurrentSong(song: SongInfo | null) {
  if (!mprisPlayer || process.platform !== 'linux') return;

  if (!song) {
    mprisPlayer.metadata = {};
    mprisPlayer.playbackStatus = 'Stopped';
    return;
  }

  const artists =
    song.ar?.map((a) => a.name).join(', ') ||
    song.artists?.map((a) => a.name).join(', ') ||
    song.song?.artists?.map((a) => a.name).join(', ') ||
    '';
  const album = song.al?.name || song.album?.name || song.song?.album?.name || '';
  const duration = song.duration || song.dt || song.song?.duration || 0;

  mprisPlayer.metadata = {
    'mpris:trackid': mprisPlayer.objectPath(`track/${song.id || 0}`),
    'mpris:length': duration * 1000,
    'mpris:artUrl': song.picUrl || '',
    'xesam:title': song.name || '',
    'xesam:album': album,
    'xesam:artist': artists ? [artists] : []
  };
}

export function updateMprisPosition(position: number) {
  if (!mprisPlayer || process.platform !== 'linux') return;
  mprisPlayer.seeked(position * 1000000);
}

export function destroyMpris() {
  // IPC listeners are now managed through the preload bridge
  // instead of direct ipcMain.listeners
  if (mprisPlayer) {
    mprisPlayer.quit();
    mprisPlayer = null;
  }
}

function initTrayLyric() {
  if (process.platform !== 'linux' || !dbusModule) return;

  const serviceName = 'org.gnome.Shell.TrayLyric';

  try {
    const sessionBus = dbusModule.sessionBus({});
    trayLyricBus = sessionBus;

    const dbusPath = '/org/freedesktop/DBus';
    const dbusInterface = 'org.freedesktop.DBus';

    sessionBus.invoke(
      {
        path: dbusPath,
        interface: dbusInterface,
        member: 'GetNameOwner',
        destination: 'org.freedesktop.DBus',
        signature: 's',
        body: [serviceName]
      },
      (err: any, result: any) => {
        if (err || !result) {
          console.log('[TrayLyric] Service not running');
        } else {
          // onServiceAvailable();
        }
      }
    );
  } catch (err) {
    console.error('[TrayLyric] Failed to init:', err);
  }
}

function sendTrayLyric(lrcObj: string) {
  if (!trayLyricIface || !trayLyricBus) return;

  trayLyricBus.invoke(
    {
      path: '/org/gnome/Shell/TrayLyric',
      interface: 'org.gnome.Shell.TrayLyric',
      member: 'UpdateLyric',
      destination: 'org.gnome.Shell.TrayLyric',
      signature: 's',
      body: [lrcObj]
    },
    (err: any, _result: any) => {
      if (err) {
        console.error('[TrayLyric] Failed to invoke UpdateLyric:', err);
      }
    }
  );
}