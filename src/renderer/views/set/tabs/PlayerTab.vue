<template>
  <div>
    <setting-section title="Playback Settings">
      <setting-item icon="ri-hq-line" title="Audio Quality" description="Select music playback quality (VIP)">
        <s-select
          v-model="setData.musicQuality"
          :options="qualityOptions"
          width="w-40 max-md:w-full"
        />
      </setting-item>

      <setting-item
        v-if="platform === 'darwin'"
        icon="ri-layout-top-line" title="Show Status Bar"
        description="You can display the music control function in your mac status bar (effective after a restart)"
      >
        <n-switch v-model:value="setData.showTopAction">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item icon="ri-play-circle-line" title="Auto Play" description="Auto resume playback when reopening the app">
        <n-switch v-model:value="setData.autoPlay">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-leaf-line" title="Pure Mode"
        description="Show only the cover and lyrics on the play page and hide the corner controls; you can turn it off here anytime"
      >
        <n-switch v-model:value="pureModeEnabled">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-save-line" title="Data Saver Mode (Beta)"
        description="Disable lyrics, videos, preloading, background syncs, and force Opus audio to save data."
      >
        <n-switch v-model:value="setData.dataSaverEnabled">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-menu-add-line" title="Crossfade"
        description="Fade out the current song and fade in the next song"
      >
        <n-switch v-model:value="setData.crossfadeEnabled">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        v-if="setData.crossfadeEnabled"
        icon="ri-timer-line" title="Crossfade Duration"
        description="Duration of the crossfade in seconds"
      >
        <div class="flex items-center gap-4">
          <n-slider
            v-model:value="setData.crossfadeDuration"
            :min="1"
            :max="15"
            :step="1"
            class="w-48"
          />
          <span>{{ setData.crossfadeDuration }}s</span>
        </div>
      </setting-item>

      <setting-item
        v-if="setData.crossfadeEnabled"
        icon="ri-skip-forward-mini-line" title="Crossfade Gapless"
        description="Skip silence at the end of the song before crossfading"
      >
        <n-switch v-model:value="setData.crossfadeGapless">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        v-if="setData.crossfadeEnabled"
        icon="ri-magic-line" title="Automix"
        description="Automatically determine crossfade points based on song structure"
      >
        <n-switch v-model:value="setData.automixCrossfade">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        v-if="setData.automixCrossfade"
        icon="ri-bug-line" title="Automix Debug Overlay"
        description="Show debug information for automix points"
      >
        <n-switch v-model:value="setData.automixDebugOverlay">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-volume-mute-line" title="Skip Silence"
        description="Automatically skip silence at the beginning and end of tracks"
      >
        <n-switch v-model:value="setData.skipSilence">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        v-if="setData.skipSilence"
        icon="ri-skip-forward-line" title="Skip Silence Instant"
        description="Skip silence instantly without fading"
      >
        <n-switch v-model:value="setData.skipSilenceInstant">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item icon="ri-equalizer-line" title="Audio Normalization" description="Normalize audio volume across tracks">
        <n-switch v-model:value="setData.audioNormalization">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-cpu-line" title="Audio Offload"
        description="Offload audio processing to hardware when possible (disabled by crossfade)"
      >
        <n-switch v-model:value="setData.audioOffload" :disabled="setData.crossfadeEnabled">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-download-cloud-line" title="Preload Next Song"
        description="Cache the next song for gapless playback"
      >
        <n-switch v-model:value="setData.preloadNextSongEnabled">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        v-if="setData.preloadNextSongEnabled"
        icon="ri-list-settings-line" title="Preload Limit"
        description="Maximum number of songs to preload"
      >
        <div class="flex items-center gap-4">
          <n-slider
            v-model:value="setData.preloadNextSongLimit"
            :min="1"
            :max="10"
            :step="1"
            class="w-48"
          />
          <span>{{ setData.preloadNextSongLimit }}</span>
        </div>
      </setting-item>

      <setting-item
        v-if="setData.preloadNextSongEnabled"
        icon="ri-text-spacing" title="Preload Lyrics"
        description="Also cache lyrics for the preloaded songs"
      >
        <n-switch v-model:value="setData.preloadLyricsEnabled">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item icon="ri-forward-10-line" title="Seek Seconds Addup" description="Add up seek seconds when skipping">
        <n-switch v-model:value="setData.seekExtraSeconds">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item icon="ri-file-copy-2-line" title="Similar Content" description="Show similar content and related artists">
        <n-switch v-model:value="setData.similarContent">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-sun-line" title="Keep Screen On"
        description="Prevent device screen from turning off during playback"
      >
        <n-switch v-model:value="setData.keepScreenOn">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-volume-mute-fill" title="Pause On Mute"
        description="Automatically pause playback when volume is muted"
      >
        <n-switch v-model:value="setData.pauseOnMute">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-bluetooth-line" title="Resume On Bluetooth Connect"
        description="Automatically resume playback when connecting a bluetooth device"
      >
        <n-switch v-model:value="setData.resumeOnBluetoothConnect">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item icon="ri-cast-line" title="Enable Google Cast" description="Enable casting to Google Cast devices">
        <n-switch v-model:value="setData.enableGoogleCast">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-error-warning-line" title="Auto Skip Next On Error"
        description="Automatically skip to the next track if a playback error occurs"
      >
        <n-switch v-model:value="setData.autoSkipNextOnError">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-heart-add-line" title="Auto Download On Like"
        description="Automatically download the track when it is liked"
      >
        <n-switch v-model:value="setData.autoDownloadOnLike">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>
    </setting-section>

    <setting-section title="DSP Settings" class="mt-8">
      <setting-item icon="ri-surround-sound-line" title="Spatial Audio" description="Enable 3D spatial audio effect">
        <n-switch v-model:value="setData.spatialAudioEnabled">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        v-if="setData.spatialAudioEnabled"
        icon="ri-equalizer-line" title="Spatial Audio Strength"
        description="Adjust the strength of spatial audio"
      >
        <div class="flex items-center gap-4">
          <n-slider
            v-model:value="setData.spatialAudioStrength"
            :min="0"
            :max="1"
            :step="0.1"
            class="w-48"
          />
          <span>{{ Math.round(setData.spatialAudioStrength * 100) }}%</span>
        </div>
      </setting-item>

      <setting-item
        icon="ri-exchange-line" title="Crossfeed"
        description="Blend left and right channels for a more natural headphone sound"
      >
        <n-switch v-model:value="setData.crossfeedEnabled">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item icon="ri-speaker-3-line" title="Bass Boost" description="Boost low frequencies">
        <div class="flex items-center gap-4">
          <n-slider
            v-model:value="setData.bassBoost"
            :min="0"
            :max="1000"
            :step="10"
            class="w-48"
          />
          <span>{{ setData.bassBoost }}</span>
        </div>
      </setting-item>

      <setting-item icon="ri-surround-sound-line" title="Virtualizer" description="Simulate surround sound">
        <div class="flex items-center gap-4">
          <n-slider
            v-model:value="setData.virtualizer"
            :min="0"
            :max="1000"
            :step="10"
            class="w-48"
          />
          <span>{{ setData.virtualizer }}</span>
        </div>
      </setting-item>
    </setting-section>

    <setting-section title="Queue Settings" class="mt-8">
      <setting-item
        icon="ri-history-line" title="History Duration"
        description="How long to keep played tracks in history"
      >
        <div class="flex items-center gap-4">
          <n-slider
            v-model:value="setData.historyDuration"
            :min="1"
            :max="100"
            :step="1"
            class="w-48"
          />
          <span>{{ setData.historyDuration }}</span>
        </div>
      </setting-item>

      <setting-item icon="ri-save-3-line" title="Persistent Queue" description="Remember queue across restarts">
        <n-switch v-model:value="setData.persistentQueue">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-arrow-down-circle-line" title="Auto Load More"
        description="Automatically load more tracks when queue is near end"
      >
        <n-switch v-model:value="setData.autoLoadMore">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-repeat-2-line" title="Disable Load More On Repeat All"
        description="Prevent auto load when queue repeat is set to all"
      >
        <n-switch v-model:value="setData.disableLoadMoreWhenRepeatAll">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-shuffle-line" title="Persistent Shuffle Across Queues"
        description="Remember the shuffle state when switching to a different queue"
      >
        <n-switch v-model:value="setData.persistentShuffleAcrossQueues">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-memory-line" title="Remember Shuffle and Repeat"
        description="Save the shuffle and repeat status on application exit"
      >
        <n-switch v-model:value="setData.rememberShuffleAndRepeat">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-shuffle-line" title="Shuffle Playlist First"
        description="Always shuffle playlist when playing it from the start"
      >
        <n-switch v-model:value="setData.shufflePlaylistFirst">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-file-copy-line" title="Prevent Duplicate Tracks in Queue"
        description="Avoid adding the same track twice to the playback queue"
      >
        <n-switch v-model:value="setData.preventDuplicateTracksInQueue">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>

      <setting-item
        icon="ri-stop-circle-line" title="Stop Music On Task Clear"
        description="Stop playback when clearing the app from recent tasks"
      >
        <n-switch v-model:value="setData.stopMusicOnTaskClear">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
      </setting-item>
    </setting-section>

    <div
      class="mt-6 p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-100 dark:border-gray-800"
    >
      <div class="text-sm font-medium text-gray-500 mb-3">Support genuine</div>
      <div class="text-base text-gray-900 dark:text-white mb-4">
        Everyone still needs to support the genuine version, this software is only for open source
        discussion. Major music membership purchase links:
      </div>
      <div class="flex gap-3 flex-wrap">
        <a
          v-for="link in memberLinks"
          :key="link.url"
          class="px-4 py-2 rounded-xl bg-gray-50 dark:bg-black/20 text-primary hover:text-primary transition-colors"
          :href="link.url"
          target="_blank"
        >
          {{ link.name }} <i class="ri-external-link-line ml-1"></i>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { isDesktop } from '@/utils';
import { LYRIC_CONFIG_CHANGE_EVENT, readLyricConfig, writeLyricConfig } from '@/utils/lyricConfig';

import { SETTINGS_DATA_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SSelect from '../SSelect.vue';

const memberLinks = [
  { name: 'NetEase Cloud Music Membership', url: 'https://music.163.com/store/vip' },
  { name: 'QQmusic membership', url: 'https://y.qq.com/portal/vipportal/' }
];

const setData = inject(SETTINGS_DATA_KEY)!;
const platform = await window.api.invoke('get-platform') || 'web';

const pureModeEnabled = ref(readLyricConfig().pureModeEnabled);

const handleLyricConfigChange = () => {
  pureModeEnabled.value = readLyricConfig().pureModeEnabled;
};

onMounted(() => {
  window.addEventListener(LYRIC_CONFIG_CHANGE_EVENT, handleLyricConfigChange);
});

onBeforeUnmount(() => {
  window.removeEventListener(LYRIC_CONFIG_CHANGE_EVENT, handleLyricConfigChange);
});

watch(pureModeEnabled, (value) => {
  writeLyricConfig({ ...readLyricConfig(), pureModeEnabled: value });
});

const qualityOptions = computed(() => [
  { label: 'Standard', value: 'standard' },
  { label: 'Higher', value: 'higher' },
  { label: 'Extreme', value: 'exhigh' },
  { label: 'Lossless', value: 'lossless' },
  { label: 'Hi-Res', value: 'hires' },
  { label: 'HD Surround', value: 'jyeffect' },
  { label: 'Immersive', value: 'sky' },
  { label: 'Dolby Atmos', value: 'dolby' },
  { label: 'Master', value: 'jymaster' }
]);
</script>
