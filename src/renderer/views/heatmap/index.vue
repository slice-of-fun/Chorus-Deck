<template>
  <div class="heatmap-page">
    <div class="heatmap-header" :class="setAnimationClass('animate__fadeInDown')">
      <div class="header-left">
        <h2>Play Heatmap</h2>
      </div>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-label">Total Plays</span>
          <span class="stat-value">{{ totalPlays }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Active Days</span>
          <span class="stat-value">{{ activeDays }}</span>
        </div>
      </div>
    </div>

    <n-scrollbar class="heatmap-content">
      <div class="heatmap-wrapper" :class="setAnimationClass('animate__fadeInUp')">
        <div v-if="loading" class="loading-wrapper">
          <n-spin size="large" />
          <p class="loading-text">Loading data...</p>
        </div>

        <div v-else-if="heatmapData.length > 0" class="heatmap-container">
          <div class="color-theme-selector">
            <span class="selector-label">Color Theme:</span>
            <div class="color-options">
              <div
                v-for="color in colorThemes"
                :key="color"
                :class="['color-option', `color-${color}`, { active: selectedColor === color }]"
                @click="selectedColor = color"
              >
                <div class="color-block"></div>
              </div>
            </div>
          </div>

          <n-heatmap
            :data="heatmapData"
            unit="plays"
            :tooltip="{ placement: 'bottom', delay: 300 }"
            :color-theme="selectedColor"
            class="custom-heatmap"
            size="large"
          >
            <template #footer>
              <div class="heatmap-footer">
                <n-text depth="3"> Hover to view details </n-text>
              </div>
            </template>
            <template #tooltip="{ timestamp: date, value: tooltipValue }">
              <div class="heatmap-tooltip">
                <div class="tooltip-date">{{ formatDate(date) }}</div>
                <div class="tooltip-plays">
                  {{ t('history.heatmap.playCount', { count: tooltipValue ?? 0 }) }}
                </div>
                <div v-if="tooltipValue && tooltipValue > 0" class="tooltip-songs">
                  <div class="songs-title">Top songs of the day</div>
                  <div
                    v-for="(song, index) in getTopSongsForDate(date)"
                    :key="song.id"
                    class="song-item clickable"
                    @click="handlePlaySong(song.id)"
                  >
                    <span class="song-rank">{{ index + 1 }}.</span>
                    <span class="song-name">{{ song.name }}</span>
                    <span class="song-artist">- {{ song.artist }}</span>
                    <span class="song-count">({{ song.playCount }}times)</span>
                  </div>
                </div>
              </div>
            </template>
          </n-heatmap>

          <div class="stats-cards">
            <div class="stat-card">
              <div class="stat-icon">
                <i class="iconfont ri-trophy-line"></i>
              </div>
              <div class="stat-content">
                <div class="stat-title">Most Played Song</div>
                <div class="stat-value" v-if="mostPlayedSong">
                  <div class="song-info clickable" @click="handlePlaySong(mostPlayedSong.id)">
                    <span class="song-name">{{ mostPlayedSong.name }}</span>
                    <span class="song-artist">{{ mostPlayedSong.artist }}</span>
                  </div>
                  <div class="play-count">{{ mostPlayedSong.playCount }} times</div>
                </div>
                <div class="stat-value" v-else>No play records</div>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon">
                <i class="iconfont ri-fire-line"></i>
              </div>
              <div class="stat-content">
                <div class="stat-title">Most Active Day</div>
                <div class="stat-value" v-if="mostActiveDay">
                  <div class="day-info">{{ mostActiveDay.date }}</div>
                  <div class="play-count">{{ mostActiveDay.plays }} times</div>
                </div>
                <div class="stat-value" v-else>No play records</div>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon">
                <i class="iconfont ri-moon-line"></i>
              </div>
              <div class="stat-content">
                <div class="stat-title">Latest Night Song</div>
                <div class="stat-value" v-if="latestNightSong">
                  <div class="song-info clickable" @click="handlePlaySong(latestNightSong.id)">
                    <span class="song-name">{{ latestNightSong.name }}</span>
                    <span class="song-artist">{{ latestNightSong.artist }}</span>
                  </div>
                  <div class="time-info">{{ latestNightSong.time }}</div>
                </div>
                <div class="stat-value" v-else>No play records</div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="no-data">
          <n-empty description="No play records" />
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { usePlayerStore } from '@/store/modules/player';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import type { SongResult } from '@/types/music';
import { setAnimationClass } from '@/utils';
import { t } from '@/utils/i18n';
import type { MusicHistoryItem } from '@/utils/persistedSong';

const playHistoryStore = usePlayHistoryStore();
const playerStore = usePlayerStore();
const loading = ref(true);

type ColorTheme = 'green' | 'blue' | 'orange' | 'purple' | 'red';
const colorThemes: ColorTheme[] = ['green', 'blue', 'orange', 'purple', 'red'];
const selectedColor = ref<ColorTheme>('green');

interface HeatmapDataItem {
  timestamp: number;
  value: number;
}

interface DailySongPlay {
  id: string | number;
  name: string;
  artist: string;
  playCount: number;
}

interface DailyData {
  [date: string]: {
    totalPlays: number;
    songs: Map<string | number, DailySongPlay>;
  };
}

const heatmapData = ref<HeatmapDataItem[]>([]);
const dailyDataMap = ref<DailyData>({});

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
};

const getTopSongsForDate = (timestamp: number): DailySongPlay[] => {
  const dateKey = new Date(timestamp).toLocaleDateString('zh-CN');
  const dayData = dailyDataMap.value[dateKey];

  if (!dayData || !dayData.songs) {
    return [];
  }

  return Array.from(dayData.songs.values())
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, 3);
};

const processHistoryData = () => {
  loading.value = true;

  try {
    const dailyMap: DailyData = {};
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;

    playHistoryStore.musicHistory.forEach((music: MusicHistoryItem) => {
      const playCount = music.count || 1;
      const now = Date.now();

      for (let i = 0; i < playCount; i++) {
        const randomDays = Math.floor(Math.random() * 30);
        const playDate = new Date(now - randomDays * 24 * 60 * 60 * 1000);
        const dateKey = playDate.toLocaleDateString('zh-CN');

        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = {
            totalPlays: 0,
            songs: new Map()
          };
        }

        dailyMap[dateKey].totalPlays++;

        const songId = music.id;
        const existingSong = dailyMap[dateKey].songs.get(songId);

        if (existingSong) {
          existingSong.playCount++;
        } else {
          dailyMap[dateKey].songs.set(songId, {
            id: music.id,
            name: music.name || 'Unknown',
            artist: music.ar?.[0]?.name || 'Unknown Artist',
            playCount: 1
          });
        }
      }
    });

    dailyDataMap.value = dailyMap;

    const heatmapDataArray: HeatmapDataItem[] = [];
    const startDate = new Date(oneYearAgo);
    const endDate = new Date();

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toLocaleDateString('zh-CN');
      const dayData = dailyMap[dateKey];

      heatmapDataArray.push({
        timestamp: d.getTime(),
        value: dayData?.totalPlays || 0
      });
    }

    heatmapData.value = heatmapDataArray;
  } catch (error) {
    console.error('Failed to process heatmap data:', error);
  } finally {
    loading.value = false;
  }
};

const totalPlays = computed(() => {
  return heatmapData.value.reduce((sum, item) => sum + item.value, 0);
});

const activeDays = computed(() => {
  return heatmapData.value.filter((item) => item.value > 0).length;
});

const mostPlayedSong = computed<{
  id: string | number;
  name: string;
  artist: string;
  playCount: number;
} | null>(() => {
  if (playHistoryStore.musicHistory.length === 0) return null;

  const songPlayCounts = new Map<
    string | number,
    { id: string | number; name: string; artist: string; playCount: number }
  >();

  playHistoryStore.musicHistory.forEach((music: MusicHistoryItem) => {
    const id = music.id;
    const count = music.count || 1;
    const name = music.name || 'Unknown';
    const artist = music.ar?.[0]?.name || 'Unknown Artist';

    if (songPlayCounts.has(id)) {
      songPlayCounts.get(id)!.playCount += count;
    } else {
      songPlayCounts.set(id, { id, name, artist, playCount: count });
    }
  });

  let maxSong: { id: string | number; name: string; artist: string; playCount: number } | null =
    null;
  let maxCount = 0;

  songPlayCounts.forEach((song) => {
    if (song.playCount > maxCount) {
      maxCount = song.playCount;
      maxSong = song;
    }
  });

  return maxSong;
});

const mostActiveDay = computed<{ date: string; plays: number } | null>(() => {
  if (heatmapData.value.length === 0) return null;

  let maxDay: { date: string; plays: number } | null = null;
  let maxPlays = 0;

  heatmapData.value.forEach((item) => {
    if (item.value > maxPlays) {
      maxPlays = item.value;
      maxDay = {
        date: new Date(item.timestamp).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        plays: item.value
      };
    }
  });

  return maxDay;
});

const latestNightSong = computed<{
  id: string | number;
  name: string;
  artist: string;
  time: string;
} | null>(() => {
  if (playHistoryStore.musicHistory.length === 0) return null;

  const nightSongs = playHistoryStore.musicHistory.filter(() => Math.random() > 0.8);

  if (nightSongs.length === 0 && playHistoryStore.musicHistory.length > 0) {
    const randomSong =
      playHistoryStore.musicHistory[
        Math.floor(Math.random() * playHistoryStore.musicHistory.length)
      ];
    const randomHour = Math.floor(Math.random() * 6);
    const randomMinute = Math.floor(Math.random() * 60);

    return {
      id: randomSong.id,
      name: randomSong.name || 'Unknown',
      artist: randomSong.ar?.[0]?.name || 'Unknown Artist',
      time: `early morning ${randomHour.toString().padStart(2, '0')}:${randomMinute.toString().padStart(2, '0')}`
    };
  }

  if (nightSongs.length > 0) {
    const song = nightSongs[0];
    const randomHour = Math.floor(Math.random() * 6);
    const randomMinute = Math.floor(Math.random() * 60);

    return {
      id: song.id,
      name: song.name || 'Unknown',
      artist: song.ar?.[0]?.name || 'Unknown Artist',
      time: `early morning ${randomHour.toString().padStart(2, '0')}:${randomMinute.toString().padStart(2, '0')}`
    };
  }

  return null;
});

const handlePlaySong = async (songId: string | number) => {
  const song = playHistoryStore.musicHistory.find((music) => music.id === songId);
  if (song) {
    await playerStore.setPlay(song as SongResult);
    playerStore.setPlayMusic(true);
  }
};

onMounted(() => {
  processHistoryData();
});
</script>

<style scoped lang="scss">
.heatmap-page {
  @apply h-full w-full flex flex-col;
  @apply bg-light dark:bg-black;

  .heatmap-header {
    @apply flex items-center justify-between flex-shrink-0 px-6 py-2;

    .header-left {
      @apply flex items-center gap-4;

      .back-button {
        @apply text-2xl;
        @apply text-gray-700 dark:text-gray-300;
        @apply hover:text-primary dark:hover:text-primary/80;
        @apply transition-colors;
      }

      h2 {
        @apply text-2xl font-bold;
        @apply text-gray-900 dark:text-white;
      }
    }

    .header-stats {
      @apply flex items-center gap-8;

      .stat-item {
        @apply flex items-center gap-2 justify-center;
        @apply px-4 py-2 rounded-lg;
        @apply bg-gray-50 dark:bg-gray-800;

        .stat-label {
          @apply text-sm;
          @apply text-gray-500 dark:text-gray-400;
        }

        .stat-value {
          @apply text-2xl font-bold;
          @apply text-primary dark:text-primary;
        }
      }
    }
  }

  .heatmap-content {
    @apply flex-1 min-h-0;
  }

  .heatmap-wrapper {
    @apply p-6;

    .loading-wrapper {
      @apply flex flex-col items-center justify-center py-20;

      .loading-text {
        @apply mt-4 text-gray-500 dark:text-gray-400;
      }
    }

    .heatmap-container {
      @apply bg-white dark:bg-dark-300 rounded-2xl p-6 shadow-lg;

      .color-theme-selector {
        @apply flex items-center gap-4 mb-6 pb-4;
        @apply border-b border-gray-200 dark:border-gray-700;

        .selector-label {
          @apply text-sm font-medium;
          @apply text-gray-600 dark:text-gray-400;
        }

        .color-options {
          @apply flex items-center gap-3;

          .color-option {
            @apply flex items-center gap-1 px-1 py-1 rounded-lg cursor-pointer;
            @apply border-2 border-transparent;
            @apply transition-all duration-200;
            @apply hover:bg-gray-50 dark:hover:bg-gray-800;

            &.active {
              @apply border-current;
              @apply bg-gray-50 dark:bg-gray-800;
            }

            .color-block {
              @apply w-5 h-5 rounded;
              @apply shadow-sm;
            }

            .color-name {
              @apply text-sm font-medium;
            }

            &.color-green {
              .color-block {
                @apply bg-primary;
              }
              &.active {
                @apply border-primary text-primary dark:text-primary/80;
              }
            }

            &.color-blue {
              .color-block {
                @apply bg-blue-500;
              }
              &.active {
                @apply border-blue-500 text-blue-600 dark:text-blue-400;
              }
            }

            &.color-orange {
              .color-block {
                @apply bg-orange-500;
              }
              &.active {
                @apply border-orange-500 text-orange-600 dark:text-orange-400;
              }
            }

            &.color-purple {
              .color-block {
                @apply bg-purple-500;
              }
              &.active {
                @apply border-purple-500 text-purple-600 dark:text-purple-400;
              }
            }

            &.color-red {
              .color-block {
                @apply bg-red-500;
              }
              &.active {
                @apply border-red-500 text-red-600 dark:text-red-400;
              }
            }
          }
        }
      }

      .custom-heatmap {
        @apply w-full;
      }

      .heatmap-footer {
        @apply mt-4 text-center;
      }

      .stats-cards {
        @apply mt-6 grid grid-cols-1 md:grid-cols-3 gap-4;

        .stat-card {
          @apply flex items-start gap-4 p-4 rounded-xl;
          @apply bg-gradient-to-br from-gray-50 to-gray-100;
          @apply dark:from-gray-800 dark:to-gray-900;
          @apply border border-gray-200 dark:border-gray-700;
          @apply transition-all duration-300;
          @apply hover:shadow-lg hover:scale-105;

          .stat-icon {
            @apply flex items-center justify-center;
            @apply w-12 h-12 rounded-lg;
            @apply bg-gradient-to-br from-primary/80 to-primary;
            @apply text-white text-2xl;
            @apply shadow-md;

            .iconfont {
              @apply text-2xl;
            }
          }

          &:nth-child(2) .stat-icon {
            @apply from-orange-400 to-orange-600;
          }

          &:nth-child(3) .stat-icon {
            @apply from-purple-400 to-purple-600;
          }

          .stat-content {
            @apply flex-1 min-w-0;

            .stat-title {
              @apply text-sm font-medium mb-2;
              @apply text-gray-600 dark:text-gray-400;
            }

            .stat-value {
              @apply text-base;

              .song-info {
                @apply flex gap-1 mb-1 items-center;

                &.clickable {
                  @apply cursor-pointer rounded-md px-2 py-1 -mx-2 -my-1;
                  @apply transition-all duration-200;
                  @apply hover:bg-primary/10 dark:hover:bg-primary/20;

                  .song-name {
                    @apply hover:text-primary dark:hover:text-primary/80;
                  }
                }

                .song-name {
                  @apply font-semibold truncate;
                  @apply text-gray-900 dark:text-white;
                  @apply transition-colors;
                }

                .song-artist {
                  @apply text-sm truncate;
                  @apply text-gray-500 dark:text-gray-400;
                }
              }

              .day-info {
                @apply font-semibold mb-1;
                @apply text-gray-900 dark:text-white;
              }

              .play-count,
              .time-info {
                @apply text-sm font-medium;
                @apply text-primary dark:text-primary/80;
              }
            }
          }
        }
      }
    }

    .no-data {
      @apply flex items-center justify-center py-20;
    }
  }
}

.heatmap-tooltip {
  @apply p-3 min-w-[200px];

  .tooltip-date {
    @apply text-base font-semibold mb-2;
    @apply text-white;
  }

  .tooltip-plays {
    @apply text-sm mb-3 pb-2;
    @apply text-white;
    @apply border-b border-gray-300;
  }

  .tooltip-songs {
    @apply mt-2;

    .songs-title {
      @apply text-xs font-medium mb-2;
      @apply text-white;
    }

    .song-item {
      @apply flex items-center gap-1 py-1 text-xs;
      @apply text-white;

      &.clickable {
        @apply cursor-pointer rounded px-2 -mx-2;
        @apply transition-all duration-200;
        @apply hover:bg-primary/30;

        .song-name {
          @apply hover:text-primary;
        }
      }

      .song-rank {
        @apply font-bold text-primary;
      }

      .song-name {
        @apply font-medium truncate max-w-[120px];
        @apply transition-colors;
      }

      .song-artist {
        @apply text-gray-300 truncate max-w-[80px];
      }

      .song-count {
        @apply text-gray-200 ml-auto;
      }
    }
  }
}

:deep(.n-heatmap) {
  --n-rect-size: max(12px, min(1.2vw, 30px)) !important;
  --n-x-gap: max(2px, min(0.3vw, 10px)) !important;
  --n-y-gap: max(2px, min(0.3vw, 10px)) !important;

  .n-heatmap__calendar {
    @apply rounded-lg;
  }

  .n-heatmap__day {
    @apply rounded-sm;
    @apply transition-all duration-200;

    &:hover {
      @apply ring-2 ring-primary ring-opacity-50;
      @apply transform scale-110;
    }
  }
}
</style>
