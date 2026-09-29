<template>
  <div class="app-container h-full w-full" :class="{ mobile: isMobile }">
    <n-config-provider
      :theme="theme === 'dark' ? darkTheme : lightTheme"
      :theme-overrides="themeOverrides"
    >
      <n-dialog-provider>
        <n-message-provider>
          <router-view></router-view>
          <disclaimer-modal></disclaimer-modal>
        </n-message-provider>
      </n-dialog-provider>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
declare global {
  interface Window {
    _applyColors?: (isDark: boolean) => void;
    _themeWatcherInitialized?: boolean;
  }
}

import { cloneDeep } from 'lodash';
import { darkTheme, type GlobalThemeOverrides, lightTheme } from 'naive-ui';
import { computed, nextTick, onMounted, onUnmounted, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';

import DisclaimerModal from '@/components/common/DisclaimerModal.vue';
import { usePlayerStore } from '@/store/modules/player';
import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { useSettingsStore } from '@/store/modules/settings';
import { isLyricWindow } from '@/utils';
import { locale } from '@/utils/i18n';

import { initAudioListeners, initMusicHook } from '@/hooks/MusicHook';
import { audioService } from '@/services/audioService';
import { isMobile } from '@/utils';
import { useAppShortcuts } from '@/utils/appShortcuts';

const settingsStore = useSettingsStore();
const playerStore = usePlayerStore();
const playerCoreStore = usePlayerCoreStore();
const router = useRouter();

watch(
  () => settingsStore.setData.language,
  (newLanguage) => {
    if (newLanguage && newLanguage !== locale.value) {
      locale.value = newLanguage;
    }
  },
  { immediate: true }
);

const theme = computed(() => {
  return settingsStore.theme;
});

import {
  argbFromHex,
  hexFromArgb,
  themeFromImage,
  themeFromSourceColor
} from '@material/material-color-utilities';

const lightThemeOverrides = reactive<GlobalThemeOverrides>({
  common: {
    primaryColor: '#000000',
    primaryColorHover: '#333333',
    primaryColorPressed: '#000000',
    primaryColorSuppl: '#333333'
  }
});

const darkThemeOverrides = reactive<GlobalThemeOverrides>({
  common: {
    primaryColor: '#ffffff',
    primaryColorHover: '#cccccc',
    primaryColorPressed: '#ffffff',
    primaryColorSuppl: '#cccccc'
  }
});

const themeOverrides = computed(() => {
  return theme.value === 'dark' ? darkThemeOverrides : lightThemeOverrides;
});

watch(
  () => [settingsStore.setData.fontFamily, settingsStore.setData.fontScope],
  ([newFont, fontScope]) => {
    const appElement = document.body;
    if (newFont && fontScope === 'global') {
      appElement.style.fontFamily = newFont;
    } else {
      appElement.style.fontFamily = '';
    }
  }
);

const handleSetLanguage = (value: string) => {
  console.log('Apply language changes:', value);
  if (value) {
    locale.value = value;
  }
};

if (!isLyricWindow.value) {
  settingsStore.initializeSettings();
  settingsStore.initializeTheme();
  settingsStore.initializeSystemFonts();
}

handleSetLanguage(settingsStore.setData.language);

useAppShortcuts();

const handleOffline = () => {
  router.push('/local-music');
};

onUnmounted(() => {
  window.removeEventListener('offline', handleOffline);
});

onMounted(async () => {
  window.addEventListener('offline', handleOffline);
  playerStore.setIsPlay(false);
  if (isLyricWindow.value) {
    return;
  }

  if (!navigator.onLine) {
    router.push('/local-music');
  }

  initMusicHook(playerStore);

  const { setupUrlExpiredHandler, setupYTMusicPlayHandler } = await import(
    '@/services/playbackController'
  );
  setupUrlExpiredHandler();
  setupYTMusicPlayHandler();

  const applyThemeFromColor = (argb: number) => {
    const m3Theme = themeFromSourceColor(argb);

    const primaryLight = hexFromArgb(m3Theme.palettes.primary.tone(40));
    const primaryDark = hexFromArgb(m3Theme.palettes.primary.tone(80));

    lightThemeOverrides.common = {
      primaryColor: primaryLight,
      primaryColorHover: hexFromArgb(m3Theme.palettes.primary.tone(50)),
      primaryColorPressed: hexFromArgb(m3Theme.palettes.primary.tone(30)),
      primaryColorSuppl: hexFromArgb(m3Theme.palettes.primary.tone(60))
    };

    darkThemeOverrides.common = {
      primaryColor: primaryDark,
      primaryColorHover: hexFromArgb(m3Theme.palettes.primary.tone(90)),
      primaryColorPressed: hexFromArgb(m3Theme.palettes.primary.tone(70)),
      primaryColorSuppl: hexFromArgb(m3Theme.palettes.primary.tone(90))
    };

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
        : '0 0 0';
    };

    const primaryLightRgb = hexToRgb(primaryLight);
    const primaryDarkRgb = hexToRgb(primaryDark);
    const secondaryLight = hexFromArgb(m3Theme.palettes.secondary.tone(50));
    const secondaryDark = hexFromArgb(m3Theme.palettes.secondary.tone(80));
    const secondaryLightVariant1 = hexFromArgb(m3Theme.palettes.secondary.tone(60));
    const secondaryLightVariant2 = hexFromArgb(m3Theme.palettes.secondary.tone(40));
    const secondaryDarkVariant1 = hexFromArgb(m3Theme.palettes.secondary.tone(90));
    const secondaryDarkVariant2 = hexFromArgb(m3Theme.palettes.secondary.tone(70));

    const secondaryLightRgb = hexToRgb(secondaryLight);
    const secondaryDarkRgb = hexToRgb(secondaryDark);
    const secondaryLightVariant1Rgb = hexToRgb(secondaryLightVariant1);
    const secondaryLightVariant2Rgb = hexToRgb(secondaryLightVariant2);
    const secondaryDarkVariant1Rgb = hexToRgb(secondaryDarkVariant1);
    const secondaryDarkVariant2Rgb = hexToRgb(secondaryDarkVariant2);

    const applyColors = (isDark: boolean) => {
      document.documentElement.style.setProperty(
        '--color-primary',
        isDark ? primaryDarkRgb : primaryLightRgb
      );
      document.documentElement.style.setProperty(
        '--color-secondary',
        isDark ? secondaryDarkRgb : secondaryLightRgb
      );
      document.documentElement.style.setProperty(
        '--color-secondary-light',
        isDark ? secondaryDarkVariant1Rgb : secondaryLightVariant1Rgb
      );
      document.documentElement.style.setProperty(
        '--color-secondary-dark',
        isDark ? secondaryDarkVariant2Rgb : secondaryLightVariant2Rgb
      );
    };

    applyColors(theme.value === 'dark');

    window._applyColors = applyColors;
  };

  if (!window._themeWatcherInitialized) {
    watch(theme, (newTheme) => {
      if (window._applyColors) {
        window._applyColors(newTheme === 'dark');
      }
    });
    window._themeWatcherInitialized = true;
  }

  const applySystemAccentColor = async () => {
    if (window.api && window.api.getSystemAccentColor) {
      try {
        const accent = await window.api.getSystemAccentColor();
        if (accent) {
          applyThemeFromColor(argbFromHex(accent));
        }
      } catch (e) {
        console.error('Failed to apply system accent color', e);
      }
    }
  };

  applySystemAccentColor();

  watch(
    () => playerStore.playMusic,
    async (newMusic) => {
      if (newMusic) {
        const picUrl = newMusic.al?.picUrl || newMusic.picUrl || newMusic.coverImgUrl;
        if (picUrl) {
          try {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = picUrl;
            img.onload = async () => {
              const m3Theme = await themeFromImage(img);
              applyThemeFromColor(m3Theme.source);
            };
            img.onerror = () => {
              applySystemAccentColor();
            };
          } catch (e) {
            console.error('Failed to apply theme from image', e);
            applySystemAccentColor();
          }
        } else {
          applySystemAccentColor();
        }
      } else {
        applySystemAccentColor();
      }
    },
    { deep: true }
  );

  await playerStore.initializePlayState();

  playerCoreStore.initAudioDeviceListener();

  if (playerStore.playMusic && playerStore.playMusic.id) {
    await nextTick();
    initAudioListeners();
    if (window.api && window.api.sendSong) {
      window.api.sendSong(cloneDeep(playerStore.playMusic));
    }
  }

  audioService.releaseOperationLock();

  if (playerStore.playMusic && playerStore.playMusic.id) {
    const { useLocalMusicStore } = await import('@/store/modules/localMusic');
    const localMusicStore = useLocalMusicStore();
    await localMusicStore.loadFromCache();
    localMusicStore.scanFolders().catch((error) => {
      console.error('[App] Automatic scanning of local music failed at startup:', error);
    });
  }
});
</script>

<style lang="scss" scoped>
.app-container {
  user-select: none;
}

.mobile {
  .text-base {
    font-size: 14px !important;
  }
}

.html:has(.mobile) {
  font-size: 14px;
}
</style>