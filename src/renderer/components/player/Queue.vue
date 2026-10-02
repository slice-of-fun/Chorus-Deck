<template>
  <div v-if="internalVisible" class="fixed-overlay" @click="closePanel"></div>

  <div
    v-if="internalVisible"
    class="queue-panel"
    :class="[
      'animate__animated',
      closing
        ? isCompact
          ? 'animate__slideOutDown'
          : 'animate__slideOutRight'
        : isCompact
          ? 'animate__slideInUp'
          : 'animate__slideInRight'
    ]"
    :data-shell-layout="isShellLayout || undefined"
    :style="panelStyle"
    @animationend="onAnimationEnd"
  >
    <div class="panel-header" :style="headerStyle">
      <div class="tabs">
        <div
          class="tab"
          :class="{ active: activeTab === 'queue' }"
          :style="activeTab === 'queue' ? activeTabStyle : {}"
          @click="switchTab('queue')"
        >
          Queue
        </div>
        <div
          class="tab"
          :class="{ active: activeTab === 'lyrics' }"
          :style="activeTab === 'lyrics' ? activeTabStyle : {}"
          @click="switchTab('lyrics')"
        >
          Lyrics
        </div>
      </div>
      <div class="header-actions">
        <n-tooltip v-if="activeTab === 'queue'" trigger="hover">
          <template #trigger>
            <div class="action-btn" @click="handleClearQueue">
              <i class="ri-delete-bin-line"></i>
            </div>
          </template>
          Clear Queue
        </n-tooltip>
        <div class="close-btn" @click="closePanel">
          <i class="ri-close-line"></i>
        </div>
      </div>
    </div>

    <div class="panel-body">
      <!-- Queue Tab -->
      <template v-if="activeTab === 'queue'">
        <!-- Current Song Info -->
        <div class="now-playing-card" v-if="playMusic" :style="nowPlayingCardStyle">
          <div class="now-playing-art">
            <n-image
              :src="getImgUrl(playMusic?.picUrl, '80y80')"
              :fallback-src="logoImg"
              class="art-img"
              preview-disabled
            />
            <div class="now-playing-indicator" :style="{ backgroundColor: accentColor }">
              <i :class="isPlaying ? 'ri-equalizer-line' : 'ri-pause-line'" class="eq-icon"></i>
            </div>
          </div>
          <div class="now-playing-info">
            <div class="now-playing-label">Now Playing</div>
            <div class="now-playing-title" v-html="playMusic.name"></div>
            <div class="now-playing-artist">
              <span v-for="(artist, i) in artistList" :key="i">
                {{ artist.name }}{{ i < artistList.length - 1 ? ' · ' : '' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Controls: Shuffle / Repeat -->
        <div class="queue-controls" :style="controlsStyle">
          <button
            class="ctrl-btn"
            :class="{ 'ctrl-active': shuffleEnabled }"
            :style="shuffleEnabled ? ctrlActiveStyle : {}"
            @click="toggleShuffle"
          >
            <i class="ri-shuffle-line"></i>
            <span>Shuffle</span>
          </button>
          <button
            class="ctrl-btn"
            :class="{ 'ctrl-active': repeatMode !== 0 }"
            :style="repeatMode !== 0 ? ctrlActiveStyle : {}"
            @click="toggleRepeat"
          >
            <i :class="repeatMode === 2 ? 'ri-repeat-one-line' : 'ri-repeat-2-line'"></i>
            <span>{{ repeatMode === 2 ? 'Repeat One' : 'Repeat' }}</span>
          </button>
        </div>

        <!-- Queue subtitle -->
        <div class="queue-subtitle" v-if="queueItems.length > 0">
          <div class="subtitle-left">
            <span class="subtitle-title">Next in queue</span>
          </div>
          <div class="subtitle-right">
            <span class="subtitle-count">
              {{ queueItems.length }} songs · {{ formatQueueDuration(totalQueueDuration) }}
            </span>
          </div>
        </div>

        <!-- Song List -->
        <div v-if="queueItems.length === 0" class="empty-queue">
          <i class="ri-music-2-line"></i>
          <p>Queue is empty</p>
        </div>

        <n-virtual-list
          v-else
          ref="queueListRef"
          :item-size="68"
          item-resizable
          :items="queueItems"
          class="queue-list"
        >
          <template #default="{ item, index }">
            <div
              class="queue-item"
              :class="{ 'is-playing': item.id === playerStore.playMusic?.id }"
              :style="item.id === playerStore.playMusic?.id ? playingItemStyle : {}"
              @click="playFromQueue(item, index, $event)"
              @dragover.prevent.stop
              @dragenter.prevent.stop
              @drop.prevent.stop="handleDrop(index)"
            >
              <div class="item-art">
                <n-image
                  :src="getImgUrl(item?.picUrl, '60y60')"
                  :fallback-src="logoImg"
                  class="item-img"
                  preview-disabled
                />
                <div
                  v-if="item.id === playerStore.playMusic?.id"
                  class="item-playing-overlay"
                  :style="{
                    backgroundColor: `color-mix(in srgb, ${accentColor} 80%, transparent)`
                  }"
                >
                  <i class="ri-equalizer-line" :style="{ color: '#fff' }"></i>
                </div>
              </div>

              <div class="item-info">
                <div
                  class="item-title"
                  :style="item.id === playerStore.playMusic?.id ? { color: accentColor } : {}"
                >
                  {{ item.name }}
                </div>
                <div class="item-artist">
                  <span v-for="(ar, i) in item.ar || item.artists || []" :key="i">
                    {{ ar.name }}{{ i < (item.ar || item.artists || []).length - 1 ? ' · ' : '' }}
                  </span>
                </div>
              </div>

              <div class="item-actions">
                <div
                  class="drag-handle"
                  draggable="true"
                  title="Reorder queue"
                  @click.stop="suppressQueueItemClick"
                  @mousedown.stop
                  @dragstart="handleDragStart($event, index)"
                  @dragend="handleDragEnd"
                >
                  <i class="ri-drag-move-2-line"></i>
                </div>
                <n-dropdown
                  :options="queueItemOptions"
                  trigger="click"
                  placement="left-start"
                  @select="handleQueueAction($event, item)"
                >
                  <div class="more-btn" title="Queue actions" @click.stop>
                    <i class="ri-more-2-fill"></i>
                  </div>
                </n-dropdown>
              </div>
            </div>
          </template>
        </n-virtual-list>
      </template>

      <!-- Lyrics Tab -->
      <template v-else>
        <div class="lyrics-container">
          <div class="lyrics-placeholder">
            <i class="ri-mic-line"></i>
            <p>Lyrics coming soon</p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NDropdown, useDialog, useMessage, useThemeVars } from 'naive-ui';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import logoImg from '@/assets/logo.png';
import SongItem from '@/components/common/SongItem.vue';
import { artistList, playMusic } from '@/hooks/MusicHook';
import { usePlaybackControl } from '@/hooks/usePlaybackControl';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import type { SongResult } from '@/types/music';
import { getImgUrl, isCompact, secondToMinute } from '@/utils';

const message = useMessage();
const dialog = useDialog();
const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const { isPlaying } = usePlaybackControl();
const themeVars = useThemeVars();

const internalVisible = ref(false);
const closing = ref(false);
const activeTab = ref<'queue' | 'lyrics'>('queue');
const isMiniMode = computed(() => settingsStore.isMiniMode);
// Desktop shell: Queue is a right-side layout column beside Main.
// Compact + mini mode keep the existing overlay / bottom-sheet behaviour.
const isShellLayout = computed(() => !isCompact.value && !isMiniMode.value);
const repeatMode = computed(() => playerStore.repeatMode);
const shuffleEnabled = computed(() => playerStore.shuffleEnabled);

// ── Color palette derived from song ──────────────────────────────────────────
const accentColor = computed(
  () => themeVars.value.primaryColor || 'var(--primary-color, #6366f1)'
);

const panelStyle = computed(() => ({
  '--accent': accentColor.value
}));

const headerStyle = computed(() => ({
  borderBottomColor: `color-mix(in srgb, ${accentColor.value} 30%, transparent)`
}));

const activeTabStyle = computed(() => ({
  color: accentColor.value,
  borderBottomColor: accentColor.value
}));

const nowPlayingCardStyle = computed(() => ({
  background: `color-mix(in srgb, ${accentColor.value} 12%, transparent)`,
  borderColor: `color-mix(in srgb, ${accentColor.value} 25%, transparent)`
}));

const controlsStyle = computed(() => ({
  borderBottomColor: `color-mix(in srgb, ${accentColor.value} 15%, transparent)`
}));

const ctrlActiveStyle = computed(() => ({
  background: `color-mix(in srgb, ${accentColor.value} 20%, transparent)`,
  color: accentColor.value,
  borderColor: `color-mix(in srgb, ${accentColor.value} 40%, transparent)`
}));

const playingItemStyle = computed(() => ({
  background: `color-mix(in srgb, ${accentColor.value} 10%, transparent)`,
  borderLeftColor: accentColor.value
}));

const switchTab = (tab: 'queue' | 'lyrics') => {
  activeTab.value = tab;
  window.dispatchEvent(new CustomEvent('queue-tab-changed', { detail: tab }));
};

const show = computed({
  get: () => playerStore.queueVisible,
  set: (value) => {
    playerStore.setQueueVisible(value);
  }
});

watch(
  show,
  (newValue) => {
    if (newValue) {
      internalVisible.value = true;
      closing.value = false;
      nextTick(() => {
        if (activeTab.value === 'queue') scrollToCurrentSong();
      });
    } else {
      if (!internalVisible.value) return;
      closing.value = true;
    }
  },
  { immediate: true }
);


const handleOpenTab = (e: CustomEvent) => {
  if (e.detail) activeTab.value = e.detail;
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && internalVisible.value) closePanel();
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('open-queue-tab', handleOpenTab as EventListener);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('open-queue-tab', handleOpenTab as EventListener);
});

const queueItems = computed(() => playerStore.queueItems as SongResult[]);
const queueListRef = ref<any>(null);
const draggedIndex = ref<number | null>(null);
const totalQueueDuration = computed(() =>
  queueItems.value.reduce((total, song) => {
    const duration = song.dt ?? song.duration ?? 0;
    return total + (duration > 100000 ? duration : duration * 1000);
  }, 0)
);

const formatQueueDuration = (durationMs: number) => secondToMinute(durationMs / 1000);
const queueItemOptions = [
  { label: 'Play next', key: 'play-next' },
  { label: 'Add to queue', key: 'add-to-queue' },
  { label: 'Remove', key: 'remove' }
];

const closePanel = () => {
  show.value = false;
};
const onAnimationEnd = () => {
  if (closing.value) internalVisible.value = false;
};

const scrollToCurrentSong = () => {
  setTimeout(() => {
    if (queueListRef.value && queueItems.value.length > 0) {
      const index = playerStore.queueIndex;
      queueListRef.value.scrollTo({ top: (index > 3 ? index - 3 : 0) * 68 });
    }
  }, 100);
};

const handleDeleteSong = (song: SongResult) => {
  playerStore.removeFromQueue(song.id);
};

const handleQueueAction = (action: string, song: SongResult) => {
  if (action === 'play-next') {
    playerStore.addToNextPlay(song);
  } else if (action === 'add-to-queue') {
    playerStore.addToQueue(song);
  } else if (action === 'remove') {
    handleDeleteSong(song);
  }
};

const playFromQueue = (song: SongResult, index: number, event?: MouseEvent) => {
  if ((event?.target as HTMLElement | null)?.closest('.item-actions')) return;
  playerStore.setPlay(song);
  if (playerStore.queueIndex !== index) playerStore.queueIndex = index;
};

const suppressQueueItemClick = () => undefined;

const toggleShuffle = () => {
  playerStore.toggleShuffle();
};

const toggleRepeat = () => {
  playerStore.toggleRepeat();
};

const handleDragStart = (event: DragEvent, index: number) => {
  event.stopPropagation();
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
  draggedIndex.value = index;
};

const handleDragEnd = () => {
  draggedIndex.value = null;
};

const handleDrop = (toIndex: number) => {
  if (draggedIndex.value !== null) {
    playerStore.moveInQueue(draggedIndex.value, toIndex);
  }
  draggedIndex.value = null;
};

const handleClearQueue = () => {
  if (queueItems.value.length === 0) {
    message.info('Queue is already empty');
    return;
  }
  if (isCompact.value) closePanel();
  dialog.warning({
    title: 'Clear Queue',
    content: 'This will clear all songs in the queue and stop the current playback. Continue?',
    positiveText: 'Confirm',
    negativeText: 'Cancel',
    style: { zIndex: 999999999 },
    onPositiveClick: () => {
      playerStore.clearPlayAll();
      message.success('Queue cleared');
    }
  });
};
</script>

<style lang="scss" scoped>
// The click-catcher only exists for the overlay presentations. In the desktop
// shell Queue is a real layout column, so there is nothing to dismiss.
.fixed-overlay {
  @apply fixed inset-0;
  pointer-events: auto;
  cursor: default;
  display: v-bind('isShellLayout || isMiniMode ? "none" : "block"');
}

.queue-panel {
  @apply flex flex-col overflow-hidden;

  position: v-bind('isShellLayout ? "relative" : "fixed"');
  z-index: v-bind('isShellLayout ? "var(--shell-z-queue)" : "9999999"');
  right: v-bind('isMiniMode || isShellLayout ? "auto" : "0"');
  top: v-bind('isMiniMode ? "76px" : isShellLayout ? "auto" : "0"');
  width: v-bind('isMiniMode ? "100%" : isShellLayout ? "clamp(260px, 28vw, 360px)" : "360px"');
  height: v-bind('isMiniMode ? "340px" : isShellLayout ? "100%" : "100vh"');
  left: v-bind('isMiniMode ? "0" : "auto"');
  flex-shrink: 0;

  // Own four edges + subtle outer corners when acting as a shell surface.
  border-radius: v-bind('isMiniMode ? "20px" : isShellLayout ? "var(--shell-radius)" : "0"');
  border-left: v-bind(
    'isMiniMode ? "none" : isShellLayout ? "none" : "1px solid rgba(255,255,255,0.08)"'
  );

  animation-duration: 0.3s !important;
  backdrop-filter: blur(20px);

  @apply bg-white/95 dark:bg-neutral-900/95;
}

// ── Header ────────────────────────────────────────────────────────────────────
.panel-header {
  @apply flex items-center justify-between px-4 py-3 flex-shrink-0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);

  .dark & {
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .tabs {
    @apply flex items-center gap-5;

    .tab {
      @apply text-sm font-semibold cursor-pointer pb-1 transition-all duration-200;
      @apply text-gray-400 dark:text-gray-500;
      border-bottom: 2px solid transparent;

      &.active {
        @apply text-gray-800 dark:text-gray-100;
        border-bottom-width: 2px;
      }

      &:hover:not(.active) {
        @apply text-gray-600 dark:text-gray-300;
      }
    }
  }

  .header-actions {
    @apply flex items-center gap-1;
  }

  .action-btn,
  .close-btn {
    @apply w-8 h-8 flex items-center justify-center rounded-full cursor-pointer;
    @apply text-gray-500 dark:text-gray-400;
    @apply hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors;

    i {
      font-size: 18px;
    }
  }

  .action-btn:hover {
    @apply text-red-500;
  }
}

// ── Body ──────────────────────────────────────────────────────────────────────
.panel-body {
  @apply flex flex-col flex-1 overflow-hidden;
}

// ── Now Playing card ──────────────────────────────────────────────────────────
.now-playing-card {
  @apply flex items-center gap-3 mx-3 my-2 p-3 rounded-2xl flex-shrink-0;
  border: 1px solid transparent;

  .now-playing-art {
    @apply relative flex-shrink-0;
    width: 48px;
    height: 48px;

    .art-img {
      @apply w-full h-full rounded-xl object-cover;
      :deep(img) {
        @apply rounded-xl w-full h-full object-cover;
      }
    }

    .now-playing-indicator {
      @apply absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center;

      .eq-icon {
        font-size: 11px;
        color: white;
      }
    }
  }

  .now-playing-info {
    @apply flex flex-col min-w-0 flex-1;

    .now-playing-label {
      @apply text-xs font-medium mb-0.5 opacity-60;
      @apply text-gray-600 dark:text-gray-400;
    }

    .now-playing-title {
      @apply text-sm font-bold truncate;
      @apply text-gray-900 dark:text-gray-100;
    }

    .now-playing-artist {
      @apply text-xs truncate opacity-70 mt-0.5;
      @apply text-gray-600 dark:text-gray-400;
    }
  }
}

// ── Controls (Shuffle / Repeat) ───────────────────────────────────────────────
.queue-controls {
  @apply flex items-center gap-2 px-3 pb-3 flex-shrink-0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);

  .dark & {
    border-bottom-color: rgba(255, 255, 255, 0.06);
  }

  .ctrl-btn {
    @apply flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200;
    @apply border text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700;
    @apply bg-transparent;

    &:hover {
      @apply bg-gray-100 dark:bg-gray-800;
    }

    i {
      font-size: 14px;
    }

    &.ctrl-active {
      // overridden by inline style
    }
  }
}

// ── Queue subtitle ────────────────────────────────────────────────────────────
.queue-subtitle {
  @apply flex items-center justify-between px-4 py-2 flex-shrink-0;

  .subtitle-title {
    @apply text-xs font-semibold uppercase tracking-wider;
    @apply text-gray-500 dark:text-gray-400;
  }

  .subtitle-count {
    @apply text-xs;
    @apply text-gray-400 dark:text-gray-500;
  }
}

// ── Song list ─────────────────────────────────────────────────────────────────
.queue-list {
  @apply flex-1 overflow-auto;
}

.queue-item {
  @apply flex items-center gap-3 px-3 py-2 cursor-pointer transition-all duration-150;
  @apply hover:bg-gray-50 dark:hover:bg-gray-800/50;
  border-left: 3px solid transparent;
  min-height: 68px;

  &.is-playing {
    border-left-width: 3px;
  }

  .item-art {
    @apply relative flex-shrink-0;
    width: 44px;
    height: 44px;

    .item-img {
      @apply w-full h-full rounded-lg object-cover;
      :deep(img) {
        @apply rounded-lg w-full h-full object-cover;
      }
    }

    .item-playing-overlay {
      @apply absolute inset-0 rounded-lg flex items-center justify-center;

      i {
        font-size: 16px;
      }
    }
  }

  .item-info {
    @apply flex flex-col min-w-0 flex-1;

    .item-title {
      @apply text-sm font-semibold truncate;
      @apply text-gray-800 dark:text-gray-200;
      transition: color 0.2s;
    }

    .item-artist {
      @apply text-xs truncate mt-0.5 opacity-70;
      @apply text-gray-500 dark:text-gray-400;
    }
  }

  .item-actions {
    @apply flex items-center gap-1 flex-shrink-0;

    .drag-handle,
    .more-btn {
      @apply w-8 h-8 flex items-center justify-center rounded-full cursor-pointer;
      @apply text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-all;

      i {
        font-size: 16px;
      }
    }

    .drag-handle {
      cursor: grab;

      &:active {
        cursor: grabbing;
      }
    }
  }
}

// ── Empty queue ───────────────────────────────────────────────────────────────
.empty-queue {
  @apply flex flex-col items-center justify-center flex-1 py-16;
  @apply text-gray-400 dark:text-gray-500;

  i {
    font-size: 48px;
    @apply mb-3;
  }
  p {
    @apply text-sm;
  }
}

// ── Lyrics ────────────────────────────────────────────────────────────────────
.lyrics-container {
  @apply flex-1 flex items-center justify-center;

  .lyrics-placeholder {
    @apply flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500;
    i {
      font-size: 40px;
    }
    p {
      @apply text-sm;
    }
  }
}

// ── Mobile overrides ──────────────────────────────────────────────────────────
// Skipped for the desktop shell, which stays a side column at any window width.
@media (max-width: 768px) {
  .queue-panel:not([data-shell-layout]) {
    position: fixed;
    width: 100%;
    height: 80vh;
    top: auto;
    bottom: 0;
    border-radius: 24px 24px 0 0;
    border-left: none;
  }
}
</style>
