import { computed, type ComputedRef, type Ref, ref } from 'vue';

import { usePlayerStore } from '@/store';
import { isMobile } from '@/utils';

type ProgressiveRenderOptions = {
  items: ComputedRef<any[]> | Ref<any[]>;

  itemHeight: ComputedRef<number> | number;

  listSelector: string;

  initialCount?: number;

  onReachEnd?: () => void;
};

export const useProgressiveRender = (options: ProgressiveRenderOptions) => {
  const { items, itemHeight, listSelector, initialCount = 40, onReachEnd } = options;

  const playerStore = usePlayerStore();
  const renderLimit = ref(initialCount);

  const getItemHeight = () => (typeof itemHeight === 'number' ? itemHeight : itemHeight.value);

  const renderedItems = computed(() => {
    const all = items.value;
    return all.slice(0, renderLimit.value);
  });

  const placeholderHeight = computed(() => {
    const unrendered = items.value.length - renderedItems.value.length;
    return Math.max(0, unrendered) * getItemHeight();
  });

  const isPlaying = computed(() => !!playerStore.playMusicUrl);

  const contentPaddingBottom = computed(() =>
    isPlaying.value && !isMobile.value ? '220px' : '80px'
  );

  const resetRenderLimit = () => {
    renderLimit.value = initialCount;
  };

  const expandTo = (index: number) => {
    renderLimit.value = Math.max(renderLimit.value, index);
  };

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    const { scrollTop, clientHeight } = target;

    const listSection = document.querySelector(listSelector) as HTMLElement;
    const listStart = listSection?.offsetTop || 0;

    const visibleBottom = scrollTop + clientHeight - listStart;
    if (visibleBottom <= 0) return;

    const bufferHeight = clientHeight;
    const neededIndex = Math.ceil((visibleBottom + bufferHeight) / getItemHeight());
    const allCount = items.value.length;

    if (neededIndex > renderLimit.value) {
      renderLimit.value = Math.min(neededIndex, allCount);
    }

    if (renderLimit.value >= allCount && onReachEnd) {
      onReachEnd();
    }
  };

  return {
    renderLimit,
    renderedItems,
    placeholderHeight,
    isPlaying,
    contentPaddingBottom,
    resetRenderLimit,
    expandTo,
    handleScroll
  };
};
