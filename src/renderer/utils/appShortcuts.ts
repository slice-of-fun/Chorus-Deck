import { onMounted, onUnmounted } from 'vue';

import { audioService } from '@/services/audioService';
import { usePlayerStore, useSettingsStore } from '@/store';

import {
  hasShortcutAction,
  normalizeShortcutAccelerator,
  normalizeShortcutsConfig,
  type ShortcutAction,
  shortcutActionOrder,
  type ShortcutsConfig
} from '../../shared/shortcuts';
import { isEditableTarget, keyboardEventToAccelerator } from './shortcutKeyboard';
import { showShortcutToast } from './shortcutToast';

const ACTION_DELAY = 260;

const actionTimestamps = new Map<ShortcutAction, number>();

let appShortcuts: ShortcutsConfig = normalizeShortcutsConfig(null);
let appShortcutsSuspended = false;
let appShortcutsInitialized = false;

const onGlobalShortcut = (action: string) => {
  if (!hasShortcutAction(action)) {
    return;
  }

  void handleShortcutAction(action);
};

const onUpdateAppShortcuts = (shortcuts: unknown) => {
  updateAppShortcuts(shortcuts);
};

const onMprisSeekOrSetPosition = (position: number) => {
  if (audioService) {
    audioService.seek(position);
  }
};

const onMprisPlay = async () => {
  const playerStore = usePlayerStore();
  if (!playerStore.play && playerStore.playMusic?.id) {
    await playerStore.setPlay({ ...playerStore.playMusic });
  }
};

const onMprisPause = async () => {
  const playerStore = usePlayerStore();
  if (playerStore.play) {
    await playerStore.handlePause();
  }
};

const onMprisNext = async () => {
  await usePlayerStore().nextPlay();
};

const onMprisPrevious = async () => {
  await usePlayerStore().prevPlay();
};

function shouldSkipAction(action: ShortcutAction): boolean {
  const now = Date.now();
  const lastTimestamp = actionTimestamps.get(action) ?? 0;

  if (now - lastTimestamp < ACTION_DELAY) {
    return true;
  }

  actionTimestamps.set(action, now);
  return false;
}

export async function handleShortcutAction(action: ShortcutAction) {
  if (shouldSkipAction(action)) {
    return;
  }

  const playerStore = usePlayerStore();
  const settingsStore = useSettingsStore();

  const showToast = (message: string, iconName: string) => {
    if (settingsStore.isMiniMode) {
      return;
    }
    showShortcutToast(message, iconName);
  };

  try {
    switch (action) {
      case 'togglePlay':
        if (playerStore.play) {
          await playerStore.handlePause();
          showToast('Pause', 'ri-pause-circle-line');
        } else if (playerStore.playMusic?.id) {
          await playerStore.setPlay({ ...playerStore.playMusic });
          showToast('Play', 'ri-play-circle-line');
        }
        break;
      case 'prevPlay':
        await playerStore.prevPlay();
        showToast('Previous', 'ri-skip-back-line');
        break;
      case 'nextPlay':
        await playerStore.nextPlay();
        showToast('Next', 'ri-skip-forward-line');
        break;
      case 'volumeUp':
        if (playerStore.getVolume() < 1) {
          const newVolume = playerStore.increaseVolume(0.1);
          showToast(`${'Volume'}${Math.round(newVolume * 100)}%`, 'ri-volume-up-line');
        }
        break;
      case 'volumeDown':
        if (playerStore.getVolume() > 0) {
          const newVolume = playerStore.decreaseVolume(0.1);
          showToast(`${'Volume'}${Math.round(newVolume * 100)}%`, 'ri-volume-down-line');
        }
        break;
      case 'toggleFavorite': {
        if (!playerStore.playMusic?.id) {
          return;
        }

        const currentSong = playerStore.playMusic;
        const currentSongId = currentSong.id;
        const isFavorite = playerStore.favoriteIds.includes(currentSongId);

        if (isFavorite) {
          playerStore.removeFromFavorite(currentSongId);
        } else {
          playerStore.addToFavorite(currentSong);
        }

        showToast(
          isFavorite
            ? `Unfavorite ${playerStore.playMusic.name}`
            : `Favorite ${playerStore.playMusic.name}`,
          isFavorite ? 'ri-heart-line' : 'ri-heart-fill'
        );
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`[AppShortcuts] Action failed: ${action}`, error);
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (appShortcutsSuspended) {
    return;
  }

  if (isEditableTarget(event.target)) {
    return;
  }

  const accelerator = keyboardEventToAccelerator(event);
  if (!accelerator) {
    return;
  }

  for (const action of shortcutActionOrder) {
    const config = appShortcuts[action];
    if (!config.enabled || config.scope !== 'app') {
      continue;
    }

    const shortcutKey = normalizeShortcutAccelerator(config.key);
    if (!shortcutKey || shortcutKey !== accelerator) {
      continue;
    }

    event.preventDefault();
    void handleShortcutAction(action);
    break;
  }
}

export function updateAppShortcuts(shortcuts: unknown) {
  appShortcuts = normalizeShortcutsConfig(shortcuts);
}

export function setAppShortcutsSuspended(suspended: boolean) {
  appShortcutsSuspended = suspended;
}

export async function initAppShortcuts() {
  appShortcutsInitialized = true;

  window.api.on('global-shortcut', onGlobalShortcut);
  window.api.on('update-app-shortcuts', onUpdateAppShortcuts);
  window.api.on('mpris-seek', onMprisSeekOrSetPosition);
  window.api.on('mpris-set-position', onMprisSeekOrSetPosition);
  window.api.on('mpris-play', onMprisPlay);
  window.api.on('mpris-pause', onMprisPause);
  window.api.on('mpris-next', onMprisNext);
  window.api.on('mpris-previous', onMprisPrevious);

  const storedShortcuts = await window.api.getStoreValue('shortcuts');
  updateAppShortcuts(storedShortcuts);

  document.addEventListener('keydown', handleKeyDown);
}

export function cleanupAppShortcuts() {
  appShortcutsInitialized = false;

  window.api.removeListener('global-shortcut', onGlobalShortcut);
  window.api.removeListener('update-app-shortcuts', onUpdateAppShortcuts);
  window.api.removeListener('mpris-seek', onMprisSeekOrSetPosition);
  window.api.removeListener('mpris-set-position', onMprisSeekOrSetPosition);
  window.api.removeListener('mpris-play', onMprisPlay);
  window.api.removeListener('mpris-pause', onMprisPause);
  window.api.removeListener('mpris-next', onMprisNext);
  window.api.removeListener('mpris-previous', onMprisPrevious);

  document.removeEventListener('keydown', handleKeyDown);
}

export function useAppShortcuts() {
  onMounted(() => {
    void initAppShortcuts();
  });

  onUnmounted(() => {
    cleanupAppShortcuts();
  });
}
