import { cloneDeep, isArray, mergeWith } from 'lodash';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

import setDataDefault from '@/../main/set.json';
import homeRouter from '@/router/home';
import { useMenuStore } from '@/store/modules/menu';
import { isElectron } from '@/utils';
import {
  applyTheme,
  getCurrentTheme,
  getSystemTheme,
  ThemeType,
  watchSystemTheme
} from '@/utils/theme';

import { type AppUpdateState, createDefaultAppUpdateState } from '../../../shared/appUpdate';

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeType>(getCurrentTheme());
  const isMobile = ref(false);
  const isMiniMode = ref(false);
  const showUpdateModal = ref(false);
  const appUpdateState = ref<AppUpdateState>(createDefaultAppUpdateState());
  const showArtistDrawer = ref(false);
  const currentArtistId = ref<number | null>(null);
  const systemFonts = ref<{ label: string; value: string }[]>([
    { label: 'System default', value: 'system-ui' }
  ]);
  const showDownloadDrawer = ref(false);

  let systemThemeCleanup: (() => void) | null = null;

  const setData = ref<any>({});

  const setSetData = (data: any) => {
    const mergedData = {
      ...setData.value,
      ...data
    };

    if (isElectron) {
      window.electron.ipcRenderer.send('set-store-value', 'set', cloneDeep(mergedData));
    } else {
      localStorage.setItem('appSettings', JSON.stringify(cloneDeep(mergedData)));
    }
    setData.value = cloneDeep(mergedData);
  };

  const getInitialSettings = () => {
    const savedSettings = isElectron
      ? window.electron.ipcRenderer.sendSync('get-store-value', 'set')
      : JSON.parse(localStorage.getItem('appSettings') || '{}');

    const customizer = (_objValue: any, srcValue: any) => {
      if (isArray(srcValue)) {
        return srcValue;
      }
      return undefined;
    };

    const mergedSettings = mergeWith({}, setDataDefault, savedSettings, customizer);

    setSetData(mergedSettings);
    return mergedSettings;
  };

  setData.value = getInitialSettings();

  const setCustomApiPlugin = (plugin: { name: string; content: string }) => {
    setSetData({
      customApiPlugin: plugin.content,
      customApiPluginName: plugin.name
    });
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

  const setMiniMode = (value: boolean) => {
    isMiniMode.value = value;
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

  const setLanguage = (language: string) => {
    setSetData({ language });
    if (isElectron) {
      window.electron.ipcRenderer.send('change-language', language);
    }
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
    if (!isElectron) return;
    if (systemFonts.value.length > 1) return;

    try {
      const fonts = await window.api.invoke('get-system-fonts');
      setSystemFonts(fonts);
    } catch (error) {
      console.error('Failed to obtain system font:', error);
    }
  };

  const calculateMobileStatus = () => {
    const userAgentFlag = navigator.userAgent.match(
      /(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i
    );
    const isMobileWidth = window.innerWidth < 500;
    const isMobileDevice = !!userAgentFlag || isMobileWidth;
    const tabletMode = setData.value?.tabletMode;

    return isMobileDevice && !tabletMode;
  };

  const updateMobileStatus = () => {
    const menuStore = useMenuStore();
    const shouldUseMobileStyle = calculateMobileStatus();

    if (shouldUseMobileStyle) {
      menuStore.setMenus(homeRouter.filter((item) => item.meta.isMobile));
    } else {
      menuStore.setMenus(homeRouter);
    }

    if (shouldUseMobileStyle) {
      document.documentElement.classList.add('mobile');
      document.documentElement.classList.remove('pc');
    } else {
      document.documentElement.classList.add('pc');
      document.documentElement.classList.remove('mobile');
    }

    isMobile.value = shouldUseMobileStyle;
  };

  watch(
    () => setData.value?.tabletMode,
    () => {
      updateMobileStatus();
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
    window.addEventListener('resize', updateMobileStatus);
  }

  return {
    setData,
    theme,
    isMobile,
    isMiniMode,
    showUpdateModal,
    appUpdateState,
    showArtistDrawer,
    currentArtistId,
    systemFonts,
    showDownloadDrawer,
    setSetData,
    toggleTheme,
    setAutoTheme,
    setMiniMode,
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
