<template>
  <div class="compact-search-result">
    <div class="result-header" :class="{ 'safe-area-top': hasSafeArea }">
      <div class="header-back" @click="goBack">
        <i class="ri-arrow-left-s-line"></i>
      </div>
      <div class="header-keyword">{{ keyword }}</div>
      <div class="header-actions">
        <div class="action-btn" @click="openSearch">
          <i class="ri-search-line"></i>
        </div>
      </div>
    </div>

    <div class="search-types">
      <div
        v-for="type in searchTypes"
        :key="type.key"
        class="type-tag"
        :class="{ active: searchType === type.key }"
        @click="selectType(type.key)"
      >
        {{ type.label }}
      </div>
    </div>

    <div class="result-content" @scroll="handleScroll">
      <div v-if="loading && !results.length" class="loading-state">
        <n-spin size="medium" />
        <span class="ml-2">Searching...</span>
      </div>

      <div v-else-if="results.length" class="result-list">
        <template v-if="searchType === SEARCH_TYPE.MUSIC">
          <song-item
            v-for="item in results"
            :key="item.id"
            :item="item"
            :is-next="true"
            @play="handlePlay"
          />
        </template>

        <template v-else>
          <search-item v-for="item in results" :key="item.id" :item="item" class="mb-3" />
        </template>

        <div v-if="isLoadingMore" class="loading-more">
          <n-spin size="small" />
          <span class="ml-2">Loading...</span>
        </div>

        <div v-if="!hasMore && results.length" class="no-more">No more results</div>
      </div>

      <div v-else-if="!loading" class="empty-state">
        <i class="ri-search-line"></i>
        <span>No search results</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import type { SearchFilter } from '@/api/provider';
import { getProvider } from '@/api/providers';
import SearchItem from '@/components/common/SearchItem.vue';
import SongItem from '@/components/common/SongItem.vue';
import { SEARCH_TYPE, SEARCH_TYPES } from '@/const/bar-const';
import { usePlayerStore } from '@/store/modules/player';
import { useSearchStore } from '@/store/modules/search';
import { locale, t } from '@/utils/i18n';

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const searchStore = useSearchStore();

const hasSafeArea = inject('hasSafeArea', false);

const keyword = ref((route.query.keyword as string) || '');

const searchType = ref(Number(route.query.type) || searchStore.searchType || 1);
const searchTypes = computed(() => {
  locale.value;
  return SEARCH_TYPES.map((type) => ({
    label: t(type.label),
    key: type.key
  }));
});

const results = ref<any[]>([]);
const loading = ref(false);

const ITEMS_PER_PAGE = 30;
const page = ref(1);
const hasMore = ref(true);
const isLoadingMore = ref(false);

const performSearch = async (isLoadMore = false) => {
  if (!keyword.value) return;

  if (isLoadMore) {
    if (!hasMore.value || isLoadingMore.value) return;
    isLoadingMore.value = true;
  } else {
    loading.value = true;
    results.value = [];
    page.value = 1;
    hasMore.value = true;
  }

  try {
    if (searchType.value === SEARCH_TYPE.MUSIC) {
      const provider = getProvider();
      const data = await provider.search({
        keywords: keyword.value,
        type: 'songs',
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const songs = data.songs || [];

      if (isLoadMore) {
        results.value = [...results.value, ...songs];
      } else {
        results.value = songs;
      }

      hasMore.value = songs.length === ITEMS_PER_PAGE;
    } else if (searchType.value === SEARCH_TYPE.ALBUM) {
      const provider = getProvider();
      const data = await provider.search({
        keywords: keyword.value,
        type: 'albums',
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const albums = data.albums || [];

      if (isLoadMore) {
        results.value = [...results.value, ...albums];
      } else {
        results.value = albums;
      }

      hasMore.value = albums.length === ITEMS_PER_PAGE;
    } else if (searchType.value === SEARCH_TYPE.PLAYLIST) {
      const provider = getProvider();
      const data = await provider.search({
        keywords: keyword.value,
        type: 'playlists',
        limit: ITEMS_PER_PAGE,
        offset: (page.value - 1) * ITEMS_PER_PAGE
      });

      const playlists = data.playlists || [];

      if (isLoadMore) {
        results.value = [...results.value, ...playlists];
      } else {
        results.value = playlists;
      }

      hasMore.value = playlists.length === ITEMS_PER_PAGE;
    }

    page.value++;
  } catch (error) {
    console.error('Search failed:', error);
  } finally {
    loading.value = false;
    isLoadingMore.value = false;
  }
};

const selectType = (type: SearchFilter) => {
  if (searchType.value === type) return;

  searchType.value = type;
  searchStore.searchType = type;

  router.replace({
    query: {
      ...route.query,
      type: type.toString()
    }
  });

  performSearch();
};

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  const { scrollTop, scrollHeight, clientHeight } = target;

  if (scrollTop + clientHeight >= scrollHeight - 100) {
    performSearch(true);
  }
};

const handlePlay = (item: any) => {
  playerStore.addToNextPlay(item);
};

const goBack = () => {
  router.back();
};

const openSearch = () => {
  router.push('/compact-search');
};

watch(
  () => route.query,
  (query) => {
    if (route.path === '/compact-search-result' && query.keyword) {
      keyword.value = query.keyword as string;
      searchType.value = Number(query.type) || searchStore.searchType || 1;
      performSearch();
    }
  }
);

onMounted(() => {
  if (keyword.value) {
    performSearch();
  }
});
</script>

<style lang="scss" scoped>
.compact-search-result {
  @apply fixed inset-0;
  @apply bg-light dark:bg-black;
  @apply flex flex-col;
}

.result-header {
  @apply flex items-center gap-3 px-4 py-3;
  @apply border-b border-gray-100 dark:border-gray-800;

  &.safe-area-top {
    padding-top: calc(var(--safe-area-inset-top, 0px) + 12px);
  }
}

.header-back {
  @apply flex items-center justify-center;
  @apply w-10 h-10 rounded-full text-xl;
  @apply text-gray-600 dark:text-gray-300;
  @apply active:bg-gray-100 dark:active:bg-gray-800;
}

.header-keyword {
  @apply flex-1 text-base font-medium;
  @apply text-gray-900 dark:text-white;
  @apply truncate;
}

.header-actions {
  @apply flex items-center gap-2;
}

.action-btn {
  @apply flex items-center justify-center;
  @apply w-10 h-10 rounded-full text-xl;
  @apply text-gray-600 dark:text-gray-300;
  @apply active:bg-gray-100 dark:active:bg-gray-800;
}

.search-types {
  @apply flex gap-2 px-4 py-3 overflow-x-auto;
  @apply border-b border-gray-100 dark:border-gray-800;

  &::-webkit-scrollbar {
    display: none;
  }
}

.type-tag {
  @apply px-4 py-1.5 rounded-full text-sm whitespace-nowrap;
  @apply bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300;
  @apply transition-colors duration-200;

  &.active {
    @apply text-primary text-white;
  }
}

.result-content {
  @apply flex-1 overflow-y-auto;
}

.loading-state {
  @apply flex flex-col items-center justify-center py-20;
  @apply text-gray-500 dark:text-gray-400;
}

.result-list {
  @apply pb-20;
}

.loading-more {
  @apply flex justify-center items-center py-4;
  @apply text-gray-500 dark:text-gray-400;
}

.no-more {
  @apply text-center py-4;
  @apply text-gray-500 dark:text-gray-400;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-20;
  @apply text-gray-400 dark:text-gray-500;

  i {
    @apply text-6xl mb-4;
  }
}
</style>
