<template>
  <div>
    <setting-section title="Appearance">
      <setting-item
        icon="ri-contrast-drop-2-line"
        title="Theme Mode"
        description="Switch between light, dark, AMOLED, or system theme"
      >
        <template #action>
          <div class="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar max-md:w-full">
            <button
              v-for="mode in themeModes"
              :key="mode.key"
              class="flex-shrink-0 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2"
              :class="
                currentThemeMode === mode.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
              "
              @click="setThemeMode(mode.key)"
            >
              <i :class="mode.icon"></i>
              {{ mode.label }}
            </button>
          </div>
        </template>
      </setting-item>

      <setting-item
        icon="ri-palette-line"
        title="Color Palette"
        description="Choose a custom accent color"
      >
        <template #action>
          <div
            class="flex flex-wrap gap-3 max-md:w-full items-center justify-end max-md:justify-start w-[400px]"
          >
            <button
              v-for="color in paletteColors"
              :key="color.value"
              class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative border-2"
              :class="
                (setData.selectedThemeColor || 'dynamic') === color.value
                  ? 'border-primary scale-110 shadow-md'
                  : 'border-transparent hover:scale-105'
              "
              :style="{
                backgroundColor:
                  color.value === 'dynamic' ? 'var(--color-surface-variant, #e5e7eb)' : color.value
              }"
              @click="setThemeColor(color.value)"
            >
              <i
                v-if="
                  color.value === 'dynamic' &&
                  (setData.selectedThemeColor || 'dynamic') !== 'dynamic'
                "
                class="ri-palette-line text-neutral-500 text-lg"
              ></i>
              <i
                v-if="(setData.selectedThemeColor || 'dynamic') === color.value"
                class="ri-check-line text-white text-lg drop-shadow-md"
                :class="{ 'text-neutral-700': color.value === 'dynamic' }"
              ></i>
            </button>
          </div>
        </template>
      </setting-item>

      <setting-item
        v-if="!isDesktop()"
        icon="ri-tablet-line"
        title="Tablet Mode"
        description="Enabling tablet mode allows using PC-style interface on mobile devices"
      >
        <n-switch v-model:value="setData.tabletMode">
          <template #checked><i class="ri-tablet-line"></i></template>
          <template #unchecked><i class="ri-smartphone-line"></i></template>
        </n-switch>
      </setting-item>

      <setting-item
        v-if="isDesktop()"
        icon="ri-font-size"
        title="Font Settings"
        description="Select fonts, prioritize fonts in order"
      >
        <template #action>
          <div class="flex gap-2 max-md:flex-col max-md:w-full">
            <n-radio-group v-model:value="setData.fontScope" class="mt-2">
              <n-radio key="global" value="global">Global</n-radio>
              <n-radio key="lyric" value="lyric">Lyrics Only</n-radio>
            </n-radio-group>
            <n-select
              v-model:value="selectedFonts"
              :options="systemFonts"
              filterable
              multiple
              placeholder="Select font"
              class="w-[300px] max-md:w-full"
              :render-label="renderFontLabel"
            />
          </div>
        </template>
      </setting-item>

      <div
        v-if="isDesktop() && selectedFonts.length > 0"
        class="p-4 border-b border-gray-100 dark:border-gray-800"
      >
        <div class="text-base font-bold mb-4 text-gray-900 dark:text-white">Font Preview</div>
        <div class="space-y-4" :style="{ fontFamily: setData.fontFamily }">
          <div v-for="preview in fontPreviews" :key="preview.key" class="flex flex-col gap-2">
            <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              {{ t(`settings.basic.fontPreview.${preview.key}`) }}
            </div>
            <div
              class="text-lg text-gray-900 dark:text-gray-100 p-3 rounded-xl bg-gray-50 dark:bg-black/20"
            >
              {{ t(`settings.basic.fontPreview.${preview.key}Text`) }}
            </div>
          </div>
        </div>
      </div>

      <setting-item icon="ri-speed-up-line" title="Animation Speed">
        <template #description>
          <div class="flex items-center gap-2">
            <n-switch v-model:value="setData.noAnimate">
              <template #checked>Off</template>
              <template #unchecked>On</template>
            </n-switch>
            <span>Enable/disable animations</span>
          </div>
        </template>
        <template #action>
          <div class="flex items-center gap-2">
            <span v-if="!isMobile" class="text-sm text-gray-400"
              >{{ setData.animationSpeed }}x</span
            >
            <div class="w-40 max-md:w-auto flex justify-end">
              <n-slider
                v-if="!isMobile"
                v-model:value="setData.animationSpeed"
                :min="0.1"
                :max="3"
                :step="0.1"
                :marks="animationSpeedMarks"
                :disabled="setData.noAnimate"
              />
              <s-input
                v-else
                v-model="setData.animationSpeed"
                type="number"
                :min="0.1"
                :max="3"
                :step="0.1"
                :disabled="setData.noAnimate"
                width="w-[120px]"
              />
            </div>
          </div>
        </template>
      </setting-item>
    </setting-section>

    <setting-section title="Player Appearance">
      <setting-item
        icon="ri-image-line"
        title="Player Background Style"
        description="Select the background style for the player"
      >
        <template #action>
          <n-select
            v-model:value="setData.playerBackgroundStyle"
            :options="playerBackgroundOptions"
            class="w-48 max-md:w-full"
          />
        </template>
      </setting-item>
      <setting-item
        icon="ri-image-2-line"
        title="Mini Player Background Style"
        description="Select the background style for the mini player"
      >
        <template #action>
          <n-select
            v-model:value="setData.miniPlayerBackgroundStyle"
            :options="miniPlayerBackgroundOptions"
            class="w-48 max-md:w-full"
          />
        </template>
      </setting-item>
      <setting-item
        icon="ri-play-circle-line"
        title="Player Buttons Style"
        description="Select the style for the player control buttons"
      >
        <template #action>
          <n-select
            v-model:value="setData.playerButtonsStyle"
            :options="playerButtonsOptions"
            class="w-48 max-md:w-full"
          />
        </template>
      </setting-item>
      <setting-item
        icon="ri-git-commit-line"
        title="Slider Style"
        description="Select the style for the progress slider"
      >
        <template #action>
          <n-select
            v-model:value="setData.sliderStyle"
            :options="sliderStyleOptions"
            class="w-48 max-md:w-full"
          />
        </template>
      </setting-item>
      <setting-item
        icon="ri-guide-line"
        title="Squiggly Slider"
        description="Enable squiggly effect on the progress slider"
      >
        <n-switch v-model:value="setData.squigglySlider" />
      </setting-item>
      <setting-item
        icon="ri-information-line"
        title="Show Codec on Player"
        description="Display audio codec information on the player"
      >
        <n-switch v-model:value="setData.showCodecOnPlayer" />
      </setting-item>
      <setting-item
        icon="ri-eye-off-line"
        title="Hide Player Thumbnail"
        description="Hide the album art thumbnail in the player"
      >
        <n-switch v-model:value="setData.hidePlayerThumbnail" />
      </setting-item>
      <setting-item
        icon="ri-crop-line"
        title="Crop Album Art"
        description="Crop album art to fit the container"
      >
        <n-switch v-model:value="setData.cropAlbumArt" />
      </setting-item>
      <setting-item
        icon="ri-magic-line"
        title="Canvas Thumbnail Animation"
        description="Enable canvas animation for thumbnails"
      >
        <n-switch v-model:value="setData.canvasThumbnailAnimation" />
      </setting-item>
      <setting-item
        icon="ri-refresh-line"
        title="Rotating Thumbnail"
        description="Enable rotating animation for thumbnails"
      >
        <n-switch v-model:value="setData.rotatingThumbnail" />
      </setting-item>
      <setting-item
        icon="ri-drag-move-2-line"
        title="Swipe Thumbnail to Change Song"
        description="Swipe on the thumbnail to skip or go back"
      >
        <n-switch v-model:value="setData.swipeThumbnail" />
      </setting-item>
      <setting-item
        icon="ri-drag-move-fill"
        title="Swipe to Song"
        description="Swipe to switch songs in lists"
      >
        <n-switch v-model:value="setData.swipeToSong" />
      </setting-item>
      <setting-item
        icon="ri-settings-4-line"
        title="Swipe Sensitivity"
        description="Adjust the sensitivity for swipe gestures"
      >
        <template #action>
          <div class="w-40 flex justify-end">
            <n-slider v-model:value="setData.swipeSensitivity" :min="0.1" :max="2.0" :step="0.1" />
          </div>
        </template>
      </setting-item>
    </setting-section>

    <setting-section title="Lyrics Appearance">
      <setting-item
        icon="ri-align-left"
        title="Lyrics Position"
        description="Alignment of the lyrics text"
      >
        <template #action>
          <n-select
            v-model:value="setData.lyricsTextPosition"
            :options="lyricsPositionOptions"
            class="w-48 max-md:w-full"
          />
        </template>
      </setting-item>
      <setting-item
        icon="ri-film-line"
        title="Lyrics Animation Style"
        description="Select the animation style for lyrics transitions"
      >
        <template #action>
          <n-select
            v-model:value="setData.lyricsAnimationStyle"
            :options="lyricsAnimationOptions"
            class="w-48 max-md:w-full"
          />
        </template>
      </setting-item>
      <setting-item
        icon="ri-font-size-2"
        title="Lyrics Text Size"
        description="Adjust the font size for lyrics"
      >
        <template #action>
          <div class="w-40 flex justify-end">
            <n-slider v-model:value="setData.lyricsTextSize" :min="16" :max="36" :step="1" />
          </div>
        </template>
      </setting-item>
      <setting-item
        icon="ri-line-height"
        title="Lyrics Line Spacing"
        description="Adjust the spacing between lines of lyrics"
      >
        <template #action>
          <div class="w-40 flex justify-end">
            <n-slider v-model:value="setData.lyricsLineSpacing" :min="1.0" :max="4.0" :step="0.1" />
          </div>
        </template>
      </setting-item>
      <setting-item
        icon="ri-cursor-line"
        title="Click to Seek"
        description="Click on a lyric line to seek to that position"
      >
        <n-switch v-model:value="setData.lyricsClick" />
      </setting-item>
      <setting-item
        icon="ri-scroll-to-bottom-line"
        title="Auto Scroll"
        description="Automatically scroll lyrics as the song plays"
      >
        <n-switch v-model:value="setData.lyricsScroll" />
      </setting-item>
      <setting-item
        icon="ri-sun-foggy-line"
        title="Glow Effect"
        description="Enable glow effect for the active lyric line"
      >
        <n-switch v-model:value="setData.lyricsGlowEffect" />
      </setting-item>
      <setting-item
        icon="ri-apple-line"
        title="Apple Music Blur Style"
        description="Use Apple Music style blur for lyrics background"
      >
        <n-switch v-model:value="setData.appleMusicLyricsBlur" />
      </setting-item>
      <setting-item
        icon="ri-blur-off-line"
        title="Standard Blur"
        description="Use standard blur for lyrics background"
      >
        <n-switch v-model:value="setData.lyricsStandardBlur" />
      </setting-item>
      <setting-item
        icon="ri-drag-move-line"
        title="Swipe Lyrics"
        description="Allow swiping on lyrics to change songs"
      >
        <n-switch v-model:value="setData.swipeLyrics" />
      </setting-item>
      <setting-item
        icon="ri-play-line"
        title="Show Play/Pause on Thumbnail"
        description="Show play/pause controls on the lyrics thumbnail"
      >
        <n-switch v-model:value="setData.enableLyricsThumbnailPlayPause" />
      </setting-item>
    </setting-section>

    <setting-section title="Library & UI Appearance">
      <setting-item
        icon="ri-home-4-line"
        title="Default Open Tab"
        description="The tab to open by default when starting the app"
      >
        <template #action>
          <n-select
            v-model:value="setData.defaultOpenTab"
            :options="defaultOpenTabOptions"
            class="w-48 max-md:w-full"
          />
        </template>
      </setting-item>
      <setting-item
        icon="ri-grid-fill"
        title="Grid Items Size"
        description="Size of items in grid views"
      >
        <template #action>
          <n-select
            v-model:value="setData.gridItemsSize"
            :options="gridItemSizeOptions"
            class="w-48 max-md:w-full"
          />
        </template>
      </setting-item>
      <setting-item
        icon="ri-filter-3-line"
        title="Default Library Filter"
        description="Default filter chip selected in library"
      >
        <template #action>
          <n-select
            v-model:value="setData.defaultLibChips"
            :options="defaultLibChipsOptions"
            class="w-48 max-md:w-full"
          />
        </template>
      </setting-item>
      <setting-item
        icon="ri-aspect-ratio-line"
        title="Density Scale"
        description="Adjust the UI density scaling"
      >
        <template #action>
          <div class="w-40 flex justify-end">
            <n-slider v-model:value="setData.densityScale" :min="0.5" :max="2.0" :step="0.1" />
          </div>
        </template>
      </setting-item>
      <setting-item
        icon="ri-heart-3-line"
        title="Show Liked Playlist"
        description="Show Liked playlist in library"
      >
        <n-switch v-model:value="setData.showLikedPlaylist" />
      </setting-item>
      <setting-item
        icon="ri-download-2-line"
        title="Show Downloaded Playlist"
        description="Show Downloaded playlist in library"
      >
        <n-switch v-model:value="setData.showDownloadedPlaylist" />
      </setting-item>
      <setting-item
        icon="ri-file-download-line"
        title="Show Exported Playlist"
        description="Show Exported playlist in library"
      >
        <n-switch v-model:value="setData.showExportedPlaylist" />
      </setting-item>
      <setting-item
        icon="ri-bar-chart-line"
        title="Show Top Playlist"
        description="Show Top playlist in library"
      >
        <n-switch v-model:value="setData.showTopPlaylist" />
      </setting-item>
      <setting-item
        icon="ri-database-2-line"
        title="Show Cached Playlist"
        description="Show Cached playlist in library"
      >
        <n-switch v-model:value="setData.showCachedPlaylist" />
      </setting-item>
      <setting-item
        icon="ri-chat-1-line"
        title="Show Comment Button"
        description="Show comments button on the player"
      >
        <n-switch v-model:value="setData.showCommentButton" />
      </setting-item>
      <setting-item
        icon="ri-delete-bin-line"
        title="Swipe to Remove Song"
        description="Swipe left/right to remove songs from lists"
      >
        <n-switch v-model:value="setData.swipeToRemoveSong" />
      </setting-item>
      <setting-item
        icon="ri-fullscreen-exit-line"
        title="Hide Status Bar on Fullscreen"
        description="Hide the OS status bar when in fullscreen mode"
      >
        <n-switch v-model:value="setData.hideStatusBarOnFullscreen" />
      </setting-item>
    </setting-section>
  </div>
</template>

<script setup lang="ts">
import { computed, h, inject, onMounted, onUnmounted, ref, watch } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';
import { isDesktop, isMobile } from '@/utils';
import { t } from '@/utils/i18n';
import { applyTheme } from '@/utils/theme';

import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SInput from '../SInput.vue';

const fontPreviews = [
  { key: 'chinese' },
  { key: 'english' },
  { key: 'japanese' },
  { key: 'korean' }
];

const settingsStore = useSettingsStore();
const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

const playerBackgroundOptions = [
  { label: 'Follow Theme', value: 'DEFAULT' },
  { label: 'Gradient', value: 'GRADIENT' },
  { label: 'Blur', value: 'BLUR' },
  { label: 'Glow Animated', value: 'GLOW_ANIMATED' },
  { label: 'Apple Music', value: 'APPLE_MUSIC' },
  { label: 'Live Mesh', value: 'LIVE_MESH' }
];

const miniPlayerBackgroundOptions = [
  { label: 'Follow Theme', value: 'DEFAULT' },
  { label: 'Blur', value: 'BLUR' },
  { label: 'Glow Animated', value: 'GLOW_ANIMATED' },
  { label: 'Live Mesh', value: 'LIVE_MESH' }
];

const playerButtonsOptions = [
  { label: 'Default', value: 'DEFAULT' },
  { label: 'Primary Color', value: 'PRIMARY' },
  { label: 'Tertiary Color', value: 'TERTIARY' }
];

const sliderStyleOptions = [{ label: 'Default', value: 'DEFAULT' }];

const lyricsPositionOptions = [
  { label: 'Left', value: 'LEFT' },
  { label: 'Center', value: 'CENTER' },
  { label: 'Right', value: 'RIGHT' }
];

const lyricsAnimationOptions = [
  { label: 'None', value: 'NONE' },
  { label: 'Fade', value: 'FADE' },
  { label: 'Glow', value: 'GLOW' },
  { label: 'Slide', value: 'SLIDE' },
  { label: 'Karaoke', value: 'KARAOKE' },
  { label: 'Apple Music Style', value: 'APPLE' },
  { label: 'Apple Music Style (Letter)', value: 'APPLE_V2' },
  { label: 'Chorus Music 1', value: 'chorusmusic_1' },
  { label: 'Lyrics V2 Fluid', value: 'LYRICS_V2' },
  { label: 'Metro Lyrics', value: 'METRO_LYRICS' }
];

const defaultOpenTabOptions = [
  { label: 'Home', value: 'HOME' },
  { label: 'Search', value: 'SEARCH' },
  { label: 'Library', value: 'LIBRARY' }
];

const gridItemSizeOptions = [
  { label: 'Small', value: 'SMALL' },
  { label: 'Big', value: 'BIG' }
];

const defaultLibChipsOptions = [
  { label: 'Library', value: 'LIBRARY' },
  { label: 'Songs', value: 'SONGS' },
  { label: 'Artists', value: 'ARTISTS' },
  { label: 'Albums', value: 'ALBUMS' },
  { label: 'Playlists', value: 'PLAYLISTS' },
  { label: 'Local', value: 'LOCAL' }
];

const themeModes = [
  { key: 'SYSTEM', label: 'System', icon: 'ri-smartphone-line' },
  { key: 'LIGHT', label: 'Light', icon: 'ri-sun-line' },
  { key: 'DARK', label: 'Dark', icon: 'ri-moon-line' },
  { key: 'AMOLED', label: 'AMOLED', icon: 'ri-moon-clear-line' }
];

const currentThemeMode = computed(() => {
  if (setData.value.autoTheme) return 'SYSTEM';
  if (setData.value.manualTheme === 'light') return 'LIGHT';
  if (setData.value.pureBlack) return 'AMOLED';
  return 'DARK';
});

const setThemeMode = (mode: string) => {
  if (mode === 'SYSTEM') {
    settingsStore.setAutoTheme(true);
    settingsStore.setSetData({ pureBlack: false });
  } else if (mode === 'LIGHT') {
    settingsStore.setAutoTheme(false);
    settingsStore.setSetData({ manualTheme: 'light', pureBlack: false });
    settingsStore.theme = 'light';
    applyTheme('light');
  } else if (mode === 'DARK') {
    settingsStore.setAutoTheme(false);
    settingsStore.setSetData({ manualTheme: 'dark', pureBlack: false });
    settingsStore.theme = 'dark';
    applyTheme('dark');
  } else if (mode === 'AMOLED') {
    settingsStore.setAutoTheme(false);
    settingsStore.setSetData({ manualTheme: 'dark', pureBlack: true });
    settingsStore.theme = 'dark';
    applyTheme('dark');
  }
};

const paletteColors = [
  { value: 'dynamic', name: 'Dynamic' },
  { value: '#EC5464', name: 'Crimson' },
  { value: '#D81B60', name: 'Rose' },
  { value: '#8E24AA', name: 'Purple' },
  { value: '#5E35B1', name: 'Deep Purple' },
  { value: '#3949AB', name: 'Indigo' },
  { value: '#1E88E5', name: 'Blue' },
  { value: '#039BE5', name: 'Sky Blue' },
  { value: '#00ACC1', name: 'Cyan' },
  { value: '#00897B', name: 'Teal' },
  { value: '#43A047', name: 'Green' },
  { value: '#7CB342', name: 'Light Green' },
  { value: '#C0CA33', name: 'Lime' },
  { value: '#FDD835', name: 'Yellow' },
  { value: '#FFB300', name: 'Amber' },
  { value: '#FB8C00', name: 'Orange' },
  { value: '#F4511E', name: 'Deep Orange' },
  { value: '#6D4C41', name: 'Brown' },
  { value: '#757575', name: 'Grey' },
  { value: '#546E7A', name: 'Blue Grey' }
];

const setThemeColor = (color: string) => {
  settingsStore.setSetData({ selectedThemeColor: color });
};

const animationSpeedMarks = computed(() => ({
  0.1: 'Very Slow',
  1: 'Normal',
  3: 'Very Fast'
}));

const systemFonts = computed(() => settingsStore.systemFonts);
const selectedFonts = ref<string[]>([]);

const renderFontLabel = (option: { label: string; value: string }) => {
  return h('span', { style: { fontFamily: option.value } }, option.label);
};

watch(
  selectedFonts,
  (newFonts) => {
    setData.value = {
      ...setData.value,
      fontFamily: newFonts.length === 0 ? 'system-ui' : newFonts.join(',')
    };
  },
  { deep: true }
);

watch(
  () => setData.value.fontFamily,
  (newFont) => {
    if (newFont) {
      selectedFonts.value = newFont === 'system-ui' ? [] : newFont.split(',');
    }
  },
  { immediate: true }
);
</script>
