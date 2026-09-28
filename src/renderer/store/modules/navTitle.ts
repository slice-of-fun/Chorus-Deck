import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useNavTitleStore = defineStore('navTitle', () => {
  const title = ref('');
  const isVisible = ref(false);

  const setTitle = (t: string) => {
    title.value = t;
  };

  const setVisible = (v: boolean) => {
    isVisible.value = v;
  };

  const clear = () => {
    title.value = '';
    isVisible.value = false;
  };

  return { title, isVisible, setTitle, setVisible, clear };
});
