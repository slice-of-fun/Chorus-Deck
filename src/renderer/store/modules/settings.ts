import { isArray, mergeWith } from 'lodash';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

import setDataDefault from '@/../shared/set.json';
import homeRouter from '@/router/home';
import { useMenuStore } from '@/store/modules/menu';
import {
  applyTheme,
  getCurrentTheme,
  getSystemTheme,
  type ThemeType,
  watchSystemTheme
} from '@/utils/theme';

import { type AppUpdateState, createDefaultAppUpdateState } from '../../../shared/appUpdate';

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeType>(getCurrentTheme());
  const isCompact = ref(false);
  const showUpdateModal = ref(false);
  const appUpdateState = ref<AppUpdateState>(createDefaultAppUpdateState());
  const showArtistDrawer = ref(false);
  const currentArtistId = ref<number | null>(null);
  const systemFonts = ref<{ label: string; value: string }[]>([
    { label: 'System default', value: 'system-ui' }
  ]);
  const showDownloadDrawer = ref(false);

  let systemThemeCleanup: (() => void) | null = null;

  const setData = ref<any>(setDataDefault);

  const setSetData = async (data: any) => {
    const mergedData = {
      ...setData.value,
      ...data
    };

    setData.value = mergedData;

    // Use Tauri invoke via the api bridge
    try {
      await window.api.setStoreValue('set', mergedData);
    } catch (error) {
      console.error('[settings] Failed to write config via Tauri:', error);
    }
  };

  const getInitialSettings = async () => {
    try {
      const savedSettings = (await window.api.getStoreValue('set')) ?? {};
      const customizer = (_objValue: any, srcValue: any) => {
        if (isArray(srcValue)) {
          return srcValue;
        }
        return undefined;
      };
      const mergedSettings = mergeWith({}, setDataDefault, savedSettings, customizer);
      setSetData(mergedSettings);
      return mergedSettings;
    } catch (error) {
      console.error('[settings] Failed to read config via Tauri:', error);
      return getInitialSettingsFallback();
    }
  };

  const getInitialSettingsFallback = () => {
    const customizer = (_objValue: any, srcValue: any) => {
      if (isArray(srcValue)) {
        return srcValue;
      }
      return undefined;
    };
    const mergedSettings = mergeWith({}, setDataDefault, {}, customizer);
    setSetData(mergedSettings);
    return mergedSettings;
  };

  const toggleTheme = () => {
    if (setData.value.autoTheme) {
      const newTheme = theme.value === 'dark' ? 'light' : 'dark';
      setSetData({
        autoTheme: false,
        manualTheme: newTheme
      });
      theme.value = newTheme;
      applyTheme(newTheme);

      if (systemThemeCleanup) {
        systemThemeCleanup();
        systemThemeCleanup = null;
      }
    } else {
      const newTheme = theme.value === 'dark' ? 'light' : 'dark';
      theme.value = newTheme;
      setSetData({ manualTheme: newTheme });
      applyTheme(newTheme);
    }
  };

  const setAutoTheme = (auto: boolean) => {
    setSetData({ autoTheme: auto });

    if (auto) {
      const systemTheme = getSystemTheme();
      theme.value = systemTheme;
      applyTheme(systemTheme);

      systemThemeCleanup = watchSystemTheme((newTheme) => {
        if (setData.value.autoTheme) {
          theme.value = newTheme;
          applyTheme(newTheme);
        }
      });
    } else {
      const manualTheme = setData.value.manualTheme || 'light';
      theme.value = manualTheme;
      applyTheme(manualTheme);

      if (systemThemeCleanup) {
        systemThemeCleanup();
        systemThemeCleanup = null;
      }
    }
  };



  const setShowUpdateModal = (value: boolean) => {
    showUpdateModal.value = value;
  };

  const setAppUpdateState = (value: AppUpdateState) => {
    appUpdateState.value = value;
  };

  const setShowArtistDrawer = (show: boolean) => {
    showArtistDrawer.value = show;
    if (!show) {
      currentArtistId.value = null;
    }
  };

  const setCurrentArtistId = (id: number) => {
    currentArtistId.value = id;
  };

  const setSystemFonts = (fonts: string[]) => {
    systemFonts.value = [
      { label: 'System default', value: 'system-ui' },
      ...fonts.map((font) => ({
        label: font,
        value: font
      }))
    ];
  };

  const setShowDownloadDrawer = (show: boolean) => {
    showDownloadDrawer.value = show;
  };

  const setLanguage = async (language: string) => {
    setSetData({ language });
    try {
      await window.api.invoke('change-language', language);
    } catch (error) {
      console.error('[settings] Failed to change language via Tauri:', error);
    }
  };

  const setCustomApiPlugin = (plugin: { name: string; content: string }) => {
    setSetData({
      customApiPlugin: plugin.content,
      customApiPluginName: plugin.name
    });
  };

  const initializeSettings = () => {};

  const initializeTheme = () => {
    if (setData.value.autoTheme) {
      setAutoTheme(true);
    } else {
      const manualTheme = setData.value.manualTheme || getCurrentTheme();
      theme.value = manualTheme;
      applyTheme(manualTheme);
    }
  };

  const initializeSystemFonts = async () => {
    // Use Tauri invoke via the api bridge
    try {
      const fonts = await window.api.getSystemFonts();
      setSystemFonts(fonts);
    } catch (error) {
      console.error('Failed to obtain system font:', error);
    }
  };

  const calculateCompactStatus = () => {
    const userAgentFlag = navigator.userAgent.match(
      /(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Compact|BlackBerry|IECompact|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i
    );
    const isDesktopClient = typeof window !== 'undefined' && Boolean((window as any).api);
    const isCompactWidth = !isDesktopClient && window.innerWidth < 500;
    const isCompactDevice = !!userAgentFlag || isCompactWidth;
    const tabletMode = setData.value?.tabletMode;

    return isCompactDevice && !tabletMode;
  };

  const updateCompactStatus = () => {
    const menuStore = useMenuStore();
    const shouldUseCompactStyle = calculateCompactStatus();

    if (shouldUseCompactStyle) {
      menuStore.setMenus(homeRouter.filter((item) => item.meta?.isCompact));
    } else {
      menuStore.setMenus(homeRouter);
    }

    if (shouldUseCompactStyle) {
      document.documentElement.classList.add('compact');
      document.documentElement.classList.remove('pc');
    } else {
      document.documentElement.classList.add('pc');
      document.documentElement.classList.remove('compact');
    }

    isCompact.value = shouldUseCompactStyle;
  };

  watch(
    () => setData.value?.tabletMode,
    () => {
      updateCompactStatus();
    },
    { immediate: true }
  );

  watch(
    () => setData.value?.pureBlack,
    (isPureBlack) => {
      if (typeof document !== 'undefined') {
        if (isPureBlack) {
          document.documentElement.classList.add('pure-black');
        } else {
          document.documentElement.classList.remove('pure-black');
        }
      }
    },
    { immediate: true }
  );

  const hexToRgbString = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;
    return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
  };

  watch(
    () => setData.value?.selectedThemeColor,
    (color) => {
      if (typeof document !== 'undefined') {
        if (color && color !== 'dynamic' && color !== '#default') {
          const rgb = hexToRgbString(color);
          if (rgb) {
            document.documentElement.style.setProperty('--color-primary', rgb);
          } else {
            document.documentElement.style.setProperty('--color-primary', color);
          }
        } else {
          document.documentElement.style.removeProperty('--color-primary');
        }
      }
    },
    { immediate: true }
  );

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateCompactStatus);
  }

  return {
    setData,
    theme,
    isCompact,
    showUpdateModal,
    appUpdateState,
    showArtistDrawer,
    currentArtistId,
    systemFonts,
    showDownloadDrawer,
    setSetData,
    toggleTheme,
    setAutoTheme,
    setShowUpdateModal,
    setAppUpdateState,
    setShowArtistDrawer,
    setCurrentArtistId,
    setSystemFonts,
    setShowDownloadDrawer,
    setLanguage,
    initializeSettings,
    initializeTheme,
    initializeSystemFonts,
    setCustomApiPlugin
  };
});
