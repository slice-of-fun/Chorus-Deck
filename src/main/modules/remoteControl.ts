import cors from 'cors';
import { ipcMain } from 'electron';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { getStore } from './config';

export interface RemoteControlConfig {
  enabled: boolean;
  port: number;
  allowedIps: string[];
}

export const defaultRemoteControlConfig: RemoteControlConfig = {
  enabled: false,
  port: 31888,
  allowedIps: []
};

let app: express.Application | null = null;
let server: any = null;
let mainWindowRef: Electron.BrowserWindow | null = null;
let currentSong: any = null;
let isPlaying: boolean = false;

function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const key in interfaces) {
    const iface = interfaces[key];
    if (iface) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          addresses.push(alias.address);
        }
      }
    }
  }

  return addresses;
}

export function initializeRemoteControl(mainWindow: Electron.BrowserWindow) {
  mainWindowRef = mainWindow;
  const store = getStore() as any;
  let config = store.get('remoteControl') as RemoteControlConfig;

  if (!config) {
    config = defaultRemoteControlConfig;
    store.set('remoteControl', config);
  }

  ipcMain.on('update-current-song', (_, song: any) => {
    currentSong = song;
  });

  ipcMain.on('update-play-state', (_, playing: boolean) => {
    isPlaying = playing;
  });

  ipcMain.on('update-remote-control-config', (_, newConfig: RemoteControlConfig) => {
    if (server) {
      stopServer();
    }

    store.set('remoteControl', newConfig);

    if (newConfig.enabled) {
      startServer(newConfig);
    }
  });

  ipcMain.handle('get-remote-control-config', () => {
    const config = store.get('remoteControl') as RemoteControlConfig;
    return config || defaultRemoteControlConfig;
  });

  ipcMain.handle('get-local-ip-addresses', () => {
    return getLocalIpAddresses();
  });

  if (config.enabled) {
    startServer(config);
  }
}

function startServer(config: RemoteControlConfig) {
  if (!mainWindowRef) {
    console.error('The main window is not initialized and the remote control service cannot be started.');
    return;
  }

  app = express();

  app.use(cors());
  app.use(express.json());

  app.use((req, res, next) => {
    const clientIp = req.ip || req.socket.remoteAddress || '';
    const cleanIp = clientIp.replace(/^::ffff:/, '');
    console.log('config', config);
    if (config.allowedIps.length === 0 || config.allowedIps.includes(cleanIp)) {
      next();
    } else {
      res.status(403).json({ error: 'UnauthorizedIPaddress' });
    }
  });

  setupRoutes(app);

  try {
    server = app.listen(config.port, () => {
      console.log(`The remote control service has been started and the listening port is: ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start remote control service:', error);
  }
}

function stopServer() {
  if (server) {
    server.close();
    server = null;
    app = null;
    console.log('Remote control service has stopped');
  }
}

function setupRoutes(app: express.Application) {
  app.get('/api/status', (_, res) => {
    res.json({
      isPlaying,
      currentSong
    });
  });

  app.post('/api/toggle-play', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'togglePlay');
    res.json({ success: true, message: 'Sent to play/pause command' });
  });

  app.post('/api/prev', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'prevPlay');
    res.json({ success: true, message: 'Previous command sent' });
  });

  app.post('/api/next', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'nextPlay');
    res.json({ success: true, message: 'Next command sent' });
  });

  app.post('/api/volume-up', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'volumeUp');
    res.json({ success: true, message: 'Volume increase command sent' });
  });

  app.post('/api/volume-down', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'volumeDown');
    res.json({ success: true, message: 'Volume down command sent' });
  });

  app.post('/api/toggle-favorite', (_, res) => {
    if (!mainWindowRef) {
      return res.status(500).json({ error: 'The main window is not initialized' });
    }
    mainWindowRef.webContents.send('global-shortcut', 'toggleFavorite');
    res.json({ success: true, message: 'Favorites sent/Cancel favorite command' });
  });

  app.get('/', (_, res) => {
    try {
      const resourcesPath = process.resourcesPath || '';
      const isDev = process.env.NODE_ENV === 'development';
      const htmlPath = path.join(process.cwd(), 'resources', 'html', 'remote-control.html');
      const finalPath = isDev ? htmlPath : path.join(resourcesPath, 'html', 'remote-control.html');

      if (fs.existsSync(finalPath)) {
        res.sendFile(finalPath);
      } else {
        res.status(404).send('Remote control interface file not found');
        console.error('The remote control interface file does not exist:', finalPath);
      }
    } catch (error) {
      console.error('Failed to load remote control interface:', error);
      res.status(500).send('Failed to load remote control interface');
    }
  });
}
