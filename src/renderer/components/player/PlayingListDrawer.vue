<template>
  <div v-if="internalVisible" class="fixed-overlay" @click="closePanel"></div>

  <div
    v-if="internalVisible"
    class="playlist-panel"
    :class="[
      'animate__animated',
      closing
        ? isMobile
          ? 'animate__slideOutDown'
          : 'animate__slideOutRight'
        : isMobile
          ? 'animate__slideInUp'
          : 'animate__slideInRight'
    ]"
    @animationend="onAnimationEnd"
  >
    <div class="playlist-panel-header">
      <div class="title">Play List</div>
      <div class="header-actions">
        <n-tooltip trigger="hover">
          <template #trigger>
            <div class="action-btn" @click="handleClearPlaylist">
              <i class="ri-delete-bin-line"></i>
            </div>
          </template>
          Clear Playlist
        </n-tooltip>
        <div class="close-btn" @click="closePanel">
          <i class="ri-close-line"></i>
        </div>
      </div>
    </div>
    <div class="playlist-panel-content">
      <div v-if="playList.length === 0" class="empty-playlist">
        <i class="ri-music-2-line"></i>
        <p>Playlist is empty</p>
      </div>
      <n-virtual-list v-else ref="playListRef" :item-size="62" item-resizable :items="playList">
        <template #default="{ item }">
          <div class="music-play-list-content">
            <div class="flex items-center justify-between">
              <song-item :key="item.id" class="flex-1" :item="item" mini></song-item>
              <div class="delete-btn" @click.stop="handleDeleteSong(item)">
                <i
                  class="ri-delete-bin-line text-gray-400 hover:text-red-500 transition-colors"
                ></i>
              </div>
            </div>
          </div>
        </template>
      </n-virtual-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDialog, useMessage } from 'naive-ui';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import SongItem from '@/components/common/SongItem.vue';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { isMobile } from '@/utils';

const message = useMessage();
const dialog = useDialog();
const playerStore = usePlayerStore();

const internalVisible = ref(false);
const closing = ref(false);

const show = computed({
  get: () => playerStore.playListDrawerVisible,
  set: (value) => {
    playerStore.setPlayListDrawerVisible(value);
  }
});

watch(
  show,
  (newValue) => {
    if (newValue) {
      internalVisible.value = true;
      closing.value = false;

      nextTick(() => {
        scrollToCurrentSong();
      });
    } else {
      if (!internalVisible.value) return;

      closing.value = true;
    }
  },
  { immediate: true }
);

const playList = computed(() => playerStore.playList as SongResult[]);

const playListRef = ref<any>(null);

const closePanel = () => {
  show.value = false;
};

const onAnimationEnd = () => {
  if (closing.value) {
    internalVisible.value = false;
  }
};

const handleClearPlaylist = () => {
  if (playList.value.length === 0) {
    message.info('Playlist is already empty');
    return;
  }

  if (isMobile.value) {
    closePanel();
  }

  dialog.warning({
    title: 'Clear Playlist',
    content: 'This will clear all songs in the playlist and stop the current playback. Continue?',
    positiveText: 'Confirm',
    negativeText: 'Cancel',
    style: { zIndex: 999999999 },
    onPositiveClick: () => {
      playerStore.clearPlayAll();
      message.success('Playlist cleared');
    }
  });
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && internalVisible.value) {
    closePanel();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

const scrollToCurrentSong = () => {
  setTimeout(() => {
    if (playListRef.value && playList.value.length > 0) {
      const index = playerStore.playListIndex;
      console.log('Scroll to song index:', index);
      playListRef.value.scrollTo({
        top: (index > 3 ? index - 3 : 0) * 62
      });
    }
  }, 100);
};

const handleDeleteSong = (song: SongResult) => {
  playerStore.removeFromPlayList(song.id);
};
</script>

<style lang="scss" scoped>
.fixed-overlay {
  @apply fixed inset-0 z-[999999];
  pointer-events: auto;
  cursor: default;
}

.playlist-panel {
  @apply fixed right-0 z-[9999999] rounded-l-xl overflow-hidden;
  width: 350px;
  height: 70vh;
  top: 15vh;
  animation-duration: 0.4s !important;

  @apply bg-light dark:bg-dark shadow-2xl dark:border dark:border-gray-700;

  &-header {
    @apply flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-900;
    backdrop-filter: blur(10px);
    background-color: rgba(255, 255, 255, 0.7);

    .dark & {
      background-color: rgba(18, 18, 18, 0.7);
    }

    .title {
      @apply text-base font-medium text-gray-800 dark:text-gray-200;
    }

    .header-actions {
      @apply flex items-center;
    }

    .action-btn,
    .close-btn {
      @apply w-8 h-8 flex items-center justify-center rounded-full cursor-pointer mx-1 text-gray-800 dark:text-gray-200;
      @apply hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors;

      .iconfont {
        @apply text-xl;
      }
    }

    .action-btn {
      @apply text-gray-500 dark:text-gray-400;
      &:hover {
        @apply text-red-500 dark:text-red-400;
      }
    }
  }

  &-content {
    @apply h-[calc(70vh-60px)] overflow-hidden;
  }
}

.empty-playlist {
  @apply flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500;

  .iconfont {
    @apply text-5xl mb-4;
  }

  p {
    @apply text-sm;
  }
}

.music-play-list-content {
  @apply pr-2 hover:bg-light-100 dark:hover:bg-dark-100;
  &:hover {
    .delete-btn {
      @apply visible;
    }
  }
  .delete-btn {
    @apply pr-2 cursor-pointer invisible;
    .iconfont {
      @apply text-lg;
    }
  }
}

@media (max-width: 768px) {
  .playlist-panel {
    position: fixed;
    width: 100%;
    height: 80vh;
    top: auto;
    bottom: 0;
    border-radius: 30px 30px 0 0;
    border-left: none;
    border-top: 1px solid theme('colors.gray.200');
    box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.1);

    &-header {
      @apply text-center relative px-4;

      &::before {
        content: '';
        position: absolute;
        top: -15px;
        left: 50%;
        transform: translateX(-50%);
        width: 40px;
        height: 5px;
        border-radius: 5px;
        background-color: rgba(150, 150, 150, 0.3);
      }
    }

    &-content {
      height: calc(80vh - 60px);
      @apply px-4;
      .delete-btn {
        @apply visible;
      }
    }
  }
}
</style>
