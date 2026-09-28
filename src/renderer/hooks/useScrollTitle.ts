import { isRef, onMounted, onUnmounted, Ref, watch } from 'vue';

import { useNavTitleStore } from '@/store/modules/navTitle';

export function useScrollTitle(title: string | Ref<string>, titleEl: Ref<HTMLElement | null>) {
  const store = useNavTitleStore();
  let observer: IntersectionObserver | null = null;

  const setupObserver = (el: HTMLElement) => {
    observer?.disconnect();
    observer = new IntersectionObserver(([entry]) => store.setVisible(!entry.isIntersecting), {
      threshold: 0,
      rootMargin: '-56px 0px 0px 0px'
    });
    observer.observe(el);
  };

  onMounted(() => {
    store.setTitle(isRef(title) ? title.value : title);

    if (titleEl.value) {
      setupObserver(titleEl.value);
    }
  });

  if (isRef(title)) {
    watch(title, (v) => store.setTitle(v));
  }

  watch(titleEl, (el) => {
    if (el) setupObserver(el);
  });

  onUnmounted(() => {
    observer?.disconnect();
    store.clear();
  });
}
