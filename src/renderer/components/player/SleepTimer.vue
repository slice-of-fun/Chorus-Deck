<template>
  <div class="sleep-timer-content">
    <h3 class="timer-title">Sleep Timer</h3>

    <div v-if="hasTimerActive" class="sleep-timer-active">
      <div class="timer-status">
        <template v-if="timerType === 'time'">
          <div class="timer-value countdown-timer">{{ formattedRemainingTime }}</div>
        </template>
        <template v-else-if="timerType === 'songs'">
          <div class="timer-value">{{ remainingSongs }}</div>
          <div class="timer-label">
            {{ t('player.sleepTimer.songsRemaining', { count: remainingSongs }) }}
          </div>
        </template>
        <template v-else-if="timerType === 'end'">
          <div class="timer-value">Active until end of playlist</div>
          <div class="timer-label">After Playlist Ends</div>
        </template>
      </div>

      <n-button type="error" class="cancel-timer-btn" @click="handleCancelTimer" round>
        Cancel Timer
      </n-button>
    </div>

    <div v-else class="sleep-timer-options">
      <div class="option-section">
        <h4 class="option-title">By Time</h4>
        <div class="time-options">
          <n-button
            v-for="minutes in [15, 30, 60, 90]"
            :key="minutes"
            size="small"
            class="time-option-btn"
            @click="handleSetTimeTimer(minutes)"
            round
          >
            {{ minutes }}min
          </n-button>
          <div class="custom-time">
            <n-input-number
              v-model:value="customMinutes"
              :min="1"
              :max="300"
              size="small"
              class="custom-time-input"
              round
            />
            <n-button
              size="small"
              type="primary"
              class="custom-time-btn"
              :disabled="!customMinutes"
              @click="handleSetTimeTimer(customMinutes)"
              round
            >
              Set
            </n-button>
          </div>
        </div>
      </div>

      <div class="option-section">
        <h4 class="option-title">By Songs</h4>
        <div class="songs-options">
          <n-button
            v-for="songs in [1, 3, 5, 10]"
            :key="songs"
            size="small"
            class="songs-option-btn"
            @click="handleSetSongsTimer(songs)"
            round
          >
            {{ songs }}songs
          </n-button>
          <div class="custom-songs">
            <n-input-number
              v-model:value="customSongs"
              :min="1"
              :max="50"
              size="small"
              class="custom-songs-input"
              round
            />
            <n-button
              size="small"
              type="primary"
              class="custom-songs-btn"
              :disabled="!customSongs"
              @click="handleSetSongsTimer(customSongs)"
              round
            >
              Set
            </n-button>
          </div>
        </div>
      </div>

      <div class="option-section playlist-end-section">
        <n-button block class="playlist-end-btn" @click="handleSetPlaylistEndTimer" round>
          After Playlist
        </n-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { usePlayerStore } from '@/store/modules/player';
import { t } from '@/utils/i18n';

const playerStore = usePlayerStore();

const { sleepTimer } = storeToRefs(playerStore);

const customMinutes = ref(30);
const customSongs = ref(5);

const refreshTrigger = ref(0);

const hasTimerActive = computed(() => {
  return playerStore.hasSleepTimerActive;
});

const timerType = computed(() => {
  return sleepTimer.value.type;
});

const remainingSongs = computed(() => {
  return playerStore.sleepTimerRemainingSongs;
});

function handleSetTimeTimer(minutes: number) {
  playerStore.setSleepTimerByTime(minutes);
}

function handleSetSongsTimer(songs: number) {
  playerStore.setSleepTimerBySongs(songs);
}

function handleSetPlaylistEndTimer() {
  playerStore.setSleepTimerAtPlaylistEnd();
}

function handleCancelTimer() {
  playerStore.clearSleepTimer();
}

const formattedRemainingTime = computed(() => {
  void refreshTrigger.value;

  if (timerType.value !== 'time' || !sleepTimer.value.endTime) {
    return '00:00:00';
  }

  const remaining = Math.max(0, sleepTimer.value.endTime - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
});

let timerInterval: number | null = null;

onMounted(() => {
  if (hasTimerActive.value && timerType.value === 'time') {
    startTimerUpdate();
  }

  watch(
    () => [hasTimerActive.value, timerType.value],
    ([newHasTimer, newType]) => {
      if (newHasTimer && newType === 'time') {
        startTimerUpdate();
      } else {
        stopTimerUpdate();
      }
    }
  );
});

function startTimerUpdate() {
  stopTimerUpdate();

  timerInterval = window.setInterval(() => {
    refreshTrigger.value = Date.now();
  }, 500) as unknown as number;
}

function stopTimerUpdate() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

onUnmounted(() => {
  stopTimerUpdate();
});
</script>

<style lang="scss" scoped>
.sleep-timer-content {
  @apply w-full p-4;

  .timer-title {
    @apply text-lg font-medium mb-4 text-center;
  }

  .sleep-timer-active {
    @apply flex flex-col items-center;

    .timer-status {
      @apply flex flex-col items-center justify-center p-8 mb-5 w-full rounded-2xl dark:bg-gray-800 dark:bg-opacity-40 dark:shadow-gray-900/20;
      background-color: rgba(255, 255, 255, 0.5);
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.05),
        0 0 0 1px rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;

      .timer-value {
        @apply text-4xl font-semibold mb-2 text-primary;

        &.countdown-timer {
          font-variant-numeric: tabular-nums;
          letter-spacing: 2px;
        }
      }

      .timer-label {
        @apply text-base text-gray-600 dark:text-gray-300;
      }
    }

    .cancel-timer-btn {
      @apply w-full py-3 text-base rounded-full transition-all duration-200;

      &:hover {
        @apply transform scale-105 shadow-md;
      }

      &:active {
        @apply transform scale-95;
      }
    }
  }

  .sleep-timer-options {
    @apply flex flex-col;

    .option-section {
      @apply mb-7;

      .option-title {
        @apply text-base font-medium mb-4 text-gray-700 dark:text-gray-200;
        letter-spacing: 0.3px;
      }

      .time-options,
      .songs-options {
        @apply flex flex-wrap gap-2;

        .time-option-btn,
        .songs-option-btn {
          @apply px-4 py-2 rounded-full text-gray-800 dark:text-gray-200 transition-all duration-200;
          background-color: rgba(255, 255, 255, 0.5);
          @apply dark:bg-gray-800 dark:bg-opacity-40 hover:bg-white dark:hover:bg-gray-700;
          box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.05),
            0 0 0 1px rgba(255, 255, 255, 0.1);
          @apply dark:shadow-gray-900/20;

          &:hover {
            @apply transform scale-105 shadow-md;
          }

          &:active {
            @apply transform scale-95;
          }
        }

        .custom-time,
        .custom-songs {
          @apply flex items-center space-x-2 mt-4 w-full;

          .custom-time-input,
          .custom-songs-input {
            @apply flex-1;
          }

          .custom-time-btn,
          .custom-songs-btn {
            @apply py-2 px-4 rounded-full transition-all duration-200;
          }
        }
      }
    }

    .playlist-end-section {
      @apply mt-2;

      .playlist-end-btn {
        @apply py-3 text-base rounded-full transition-all duration-200;
      }
    }
  }
}
</style>
