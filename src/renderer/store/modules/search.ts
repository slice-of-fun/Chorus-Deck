import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { SearchFilter } from '@/api/provider';

export const useSearchStore = defineStore('search', () => {
  const searchValue = ref('');
  const searchType = ref<SearchFilter>('songs');

  const setSearchValue = (value: string) => {
    searchValue.value = value;
  };

  const setSearchType = (type: SearchFilter) => {
    searchType.value = type;
  };

  return {
    searchValue,
    searchType,
    setSearchValue,
    setSearchType
  };
});
