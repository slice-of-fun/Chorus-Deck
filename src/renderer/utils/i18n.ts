import { ref } from 'vue';

export const locale = ref('en');

export const t = (key: string, _opts?: any) => {
  if (!key) return '';
  const parts = key.split('.');
  return parts[parts.length - 1];
};
