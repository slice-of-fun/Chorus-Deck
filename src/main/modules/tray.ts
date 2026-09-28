import {
  app,
  BrowserWindow,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  nativeImage,
  Tray
} from 'electron';
import { join } from 'path';

import { getStore } from './config';

interface SongInfo {
  name: string;
  song: {
    artists: Array<{ name: string; [key: string]: any }>;
    [key: string]: any;
  };
  [key: string]: any;
}

let tray: Tray | null = null;

let playPauseTray: Tray | null = null;
let prevTray: Tray | null = null;
let nextTray: Tray | null = null;
let songTitleTray: Tray | null = null;

let isPlaying = false;
let currentSong: SongInfo | null = null;

export function updatePlayState(playing: boolean) {
  isPlaying = playing;
  if (tray) {
    updateTrayMenu(BrowserWindow.getAllWindows()[0]);
  }

  updateStatusBarTray();
}

function getArtistString(song: SongInfo | null): string {
  if (!song || !song.song || !song.song.artists) return '';
  return song.song.artists.map((item) => item.name).join(' / ');
}

function getSongTitle(song: SongInfo | null): string {
  if (!song) return 'Not played';
  const artistStr = getArtistString(song);
  return artistStr ? `${song.name} - ${artistStr}` : song.name;
}

function getTruncatedSongTitle(song: SongInfo | null, maxLength: number = 14): string {
  const fullTitle = getSongTitle(song);
  if (fullTitle.length <= maxLength) return fullTitle;
  return fullTitle.slice(0, maxLength) + '...';
}

export function updateCurrentSong(song: SongInfo | null) {
  currentSong = song;
  if (tray) {
    updateTrayMenu(BrowserWindow.getAllWindows()[0]);
  }

  updateStatusBarTray();
}

function getProperIconSize() {
  const height = 18;
  const width = 18;
  return { width, height };
}

function updateStatusBarTray() {
  if (process.platform !== 'darwin') return;

  const iconSize = getProperIconSize();

  if (songTitleTray) {
    if (currentSong) {
      const songName = currentSong.name.slice(0, 10);
      let title = songName;
      const artistStr = getArtistString(currentSong);

      if (artistStr) {
        title = `${songName} - ${artistStr.slice(0, 6)}${artistStr.length > 6 ? '..' : ''}`;
      }

      songTitleTray.setTitle(title, {
        fontType: 'monospacedDigit'
      });

      const fullTitle = getSongTitle(currentSong);
      songTitleTray.setToolTip(fullTitle);
      console.log('Update status bar song display:', title, 'Complete information:', fullTitle);
    } else {
      songTitleTray.setTitle('Not played', {
        fontType: 'monospacedDigit'
      });
      songTitleTray.setToolTip('Not played');
      console.log('Update status bar song display: Not played');
    }
  }

  if (playPauseTray) {
    const iconPath = join(
      app.getAppPath(),
      'resources/icons',
      isPlaying ? 'pause.png' : 'play.png'
    );
    const icon = nativeImage.createFromPath(iconPath).resize(iconSize);
    icon.setTemplateImage(true);
    playPauseTray.setImage(icon);
    playPauseTray.setToolTip(isPlaying ? 'Pause' : 'Play');
  }
}

export function updateTrayMenu(mainWindow: BrowserWindow) {
  if (!tray) return;

  if (process.platform === 'darwin') {
    const menu = new Menu();

    if (currentSong) {
      menu.append(
        new MenuItem({
          label: getTruncatedSongTitle(currentSong),
          enabled: false,
          type: 'normal'
        })
      );
      menu.append(new MenuItem({ type: 'separator' }));
    }

    menu.append(
      new MenuItem({
        label: 'Previous',
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'prevPlay');
        }
      })
    );

    menu.append(
      new MenuItem({
        label: isPlaying ? 'Pause' : 'Play',
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'togglePlay');
        }
      })
    );

    menu.append(
      new MenuItem({
        label: 'Favorite',
        type: 'normal',
        click: () => {
          console.log('[Tray] Send favorite command - macOSmenu');
          mainWindow.webContents.send('global-shortcut', 'toggleFavorite');
        }
      })
    );

    menu.append(
      new MenuItem({
        label: 'Next',
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'nextPlay');
        }
      })
    );

    menu.append(new MenuItem({ type: 'separator' }));

    menu.append(
      new MenuItem({
        label: 'Show',
        type: 'normal',
        click: () => {
          mainWindow.show();
        }
      })
    );

    menu.append(
      new MenuItem({
        label: 'Quit',
        type: 'normal',
        click: () => {
          app.quit();
        }
      })
    );

    tray.setContextMenu(menu);
  } else {
    const menuTemplate: MenuItemConstructorOptions[] = [
      ...((currentSong
        ? [
            {
              label: getTruncatedSongTitle(currentSong),
              enabled: false,
              type: 'normal'
            },
            { type: 'separator' }
          ]
        : []) as MenuItemConstructorOptions[]),
      {
        label: 'Show',
        type: 'normal',
        click: () => {
          mainWindow.show();
        }
      },
      {
        label: 'Favorite',
        type: 'normal',
        click: () => {
          console.log('[Tray] Send favorite command - Windows/Linuxmenu');
          mainWindow.webContents.send('global-shortcut', 'toggleFavorite');
        }
      },
      { type: 'separator' },
      {
        label: 'Previous',
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'prevPlay');
        }
      },
      {
        label: isPlaying ? 'Pause' : 'Play',
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'togglePlay');
        }
      },
      {
        label: 'Next',
        type: 'normal',
        click: () => {
          mainWindow.webContents.send('global-shortcut', 'nextPlay');
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        type: 'normal',
        click: () => {
          app.quit();
        }
      }
    ];

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    tray.setContextMenu(contextMenu);
  }
}

function initializeStatusBarTray(mainWindow: BrowserWindow) {
  const store = getStore();
  if (process.platform !== 'darwin' || !store.get('set.showTopAction')) return;

  const iconSize = getProperIconSize();

  const nextIcon = nativeImage
    .createFromPath(join(app.getAppPath(), 'resources/icons', 'next.png'))
    .resize(iconSize);
  nextIcon.setTemplateImage(true);
  nextTray = new Tray(nextIcon);
  nextTray.setToolTip('Next');
  nextTray.on('click', () => {
    mainWindow.webContents.send('global-shortcut', 'nextPlay');
  });

  const playPauseIcon = nativeImage
    .createFromPath(join(app.getAppPath(), 'resources/icons', isPlaying ? 'pause.png' : 'play.png'))
    .resize(iconSize);
  playPauseIcon.setTemplateImage(true);
  playPauseTray = new Tray(playPauseIcon);
  playPauseTray.setToolTip(isPlaying ? 'Pause' : 'Play');
  playPauseTray.on('click', () => {
    mainWindow.webContents.send('global-shortcut', 'togglePlay');
  });

  const prevIcon = nativeImage
    .createFromPath(join(app.getAppPath(), 'resources/icons', 'prev.png'))
    .resize(iconSize);
  prevIcon.setTemplateImage(true);
  prevTray = new Tray(prevIcon);
  prevTray.setToolTip('Previous');
  prevTray.on('click', () => {
    mainWindow.webContents.send('global-shortcut', 'prevPlay');
  });

  const titleIcon = nativeImage
    .createFromPath(join(app.getAppPath(), 'resources/icons', 'note.png'))
    .resize({ width: 16, height: 16 });
  titleIcon.setTemplateImage(true);
  songTitleTray = new Tray(titleIcon);

  const initialText = getSongTitle(currentSong);

  songTitleTray.setTitle(initialText, {
    fontType: 'monospacedDigit'
  });

  songTitleTray.setToolTip(initialText);
  songTitleTray.on('click', () => {
    mainWindow.show();
  });

  updateStatusBarTray();

  console.log('The status bar is initialized and the song title is displayed.:', initialText);
}

export function initializeTray(iconPath: string, mainWindow: BrowserWindow) {
  const iconSize = process.platform === 'darwin' ? 18 : 16;
  const iconFile = process.platform === 'darwin' ? 'icon_16x16.png' : 'icon_16x16.png';

  const trayIcon = nativeImage
    .createFromPath(join(iconPath, iconFile))
    .resize({ width: iconSize, height: iconSize });

  tray = new Tray(trayIcon);

  tray.setToolTip('Chorus Deck');

  updateTrayMenu(mainWindow);

  initializeStatusBarTray(mainWindow);

  if (process.platform === 'darwin') {
    tray.on('click', () => {
      if (tray) {
        tray.popUpContextMenu();
      }
    });
  } else {
    tray.on('click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    });
  }

  return tray;
}
