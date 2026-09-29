import { computed } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';

export const setBackgroundImg = (url: String) => {
  return `background-image:url(${url})`;
};

export const setAnimationClass = (type: String) => {
  const settingsStore = useSettingsStore();
  if (settingsStore.setData && settingsStore.setData.noAnimate) {
    return '';
  }
  const speed = settingsStore.setData?.animationSpeed || 1;

  let speedClass = '';
  if (speed <= 0.3) speedClass = 'animate__slower';
  else if (speed <= 0.8) speedClass = 'animate__slow';
  else if (speed >= 2.5) speedClass = 'animate__faster';
  else if (speed >= 1.5) speedClass = 'animate__fast';

  return `animate__animated ${type}${speedClass ? ` ${speedClass}` : ''}`;
};

export const setAnimationDelay = (index: number = 6, time: number = 50) => {
  const settingsStore = useSettingsStore();
  if (settingsStore.setData?.noAnimate) {
    return '';
  }
  const speed = settingsStore.setData?.animationSpeed || 1;
  return `animation-delay:${(index * time) / (speed * 2)}ms`;
};

export const calculateAnimationDelay = (index: any, baseDelay: number = 0.03): string => {
  const settingsStore = useSettingsStore();
  if (settingsStore.setData?.noAnimate) {
    return '0s';
  }
  const speed = settingsStore.setData?.animationSpeed || 1;

  const delay = (index * baseDelay) / speed;
  return `${delay.toFixed(3)}s`;
};

export const secondToMinute = (s: number) => {
  if (!s || s < 0) {
    return '00:00';
  }
  const hour: number = Math.floor(s / 3600);
  const minute: number = Math.floor((s % 3600) / 60);
  const second: number = Math.floor(s % 60);
  const pad = (n: number): string => (n > 9 ? `${n}` : `0${n}`);
  if (hour > 0) {
    return `${hour}:${pad(minute)}:${pad(second)}`;
  }
  return `${pad(minute)}:${pad(second)}`;
};

const units = [
  { value: 1e8, symbol: '100 million' },
  { value: 1e4, symbol: 'Ten thousand' }
];

export const formatNumber = (num: string | number) => {
  num = Number(num);
  for (let i = 0; i < units.length; i++) {
    if (num >= units[i].value) {
      return `${(num / units[i].value).toFixed(1)}${units[i].symbol}`;
    }
  }
  return num.toString();
};

export const getImgUrl = (url: string | undefined, size: string = '') => {
  if (!url) return '';

  if (url.startsWith('data:') || url.startsWith('local://')) return url;

  if (url.includes('thumbnail')) {
    return url.replace(/thumbnail=\d+y\d+(?!.*thumbnail)/, `thumbnail=${size}`);
  }

  const imgUrl = `${url}?param=${size}`;
  return imgUrl;
};

export const isMobile = computed(() => {
  const settingsStore = useSettingsStore();
  return settingsStore.isMobile;
});

/**
 * True when the Tauri bridge has been installed, i.e. we are running inside the
 * desktop shell rather than a plain browser (`npm run dev:web`).
 *
 * Evaluated lazily because the bridge is installed from `main.ts` after the
 * module graph has already been evaluated.
 */
export const isDesktop = (): boolean => typeof window !== 'undefined' && Boolean(window.api);

export const isLyricWindow = computed(() => {
  return window.location.hash.includes('lyric');
});

export const getSetData = async (): Promise<any> => {
  if (window.api) {
    return window.api.getStoreValue('set');
  }
  const settingsStore = useSettingsStore();
  return settingsStore.setData;
};
