<template>
  <div
    class="search-item group cursor-pointer transition-all duration-300 flex flex-col"
    @click="handleClick"
  >
    <div
      class="relative overflow-hidden rounded-2xl shadow-sm transition-all duration-500 group-hover:shadow-xl group-hover:-translate-y-1 aspect-square"
    >
      <n-image
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        :src="getImgUrl(item.picUrl, '400y400')"
        lazy
        preview-disabled
      />

      <div
        v-if="item.type === 'album' && item.size"
        class="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      >
        <i class="ri-music-2-line" />
        <span>{{ item.size }}</span>
      </div>
    </div>

    <div class="mt-3 space-y-1 px-1">
      <h3
        class="line-clamp-1 text-sm font-bold text-neutral-800 transition-colors duration-200 group-hover:text-primary dark:text-neutral-200 dark:group-hover:text-white md:text-base"
      >
        {{ item.name }}
      </h3>
      <p class="line-clamp-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {{ item.desc }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { usePlayerStore } from '@/store/modules/player';
import { usePlayHistoryStore } from '@/store/modules/playHistory';
import { getImgUrl } from '@/utils';

const props = defineProps<{
  item: {
    id: number;
    picUrl: string;
    name: string;
    desc: string;
    type: string;
    [key: string]: any;
  };
}>();

const showPop = ref(false);

const playerStore = usePlayerStore();
const router = useRouter();
const playHistoryStore = usePlayHistoryStore();

const handleClick = async () => {
  if (props.item.type === 'album') {
    navigateToMusicList(router, {
      id: props.item.id,
      type: 'album',
      name: props.item.name,
      listInfo: {
        ...props.item,
        coverImgUrl: props.item.picUrl
      },
      canRemove: false
    });
  } else if (props.item.type === 'playlist') {
    navigateToMusicList(router, {
      id: props.item.id,
      type: 'playlist',
      name: props.item.name,
      listInfo: { picUrl: props.item.picUrl },
      canRemove: false
    });
  }
};
</script>

<style scoped lang="scss">
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
