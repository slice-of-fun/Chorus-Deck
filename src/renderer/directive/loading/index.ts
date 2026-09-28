import { createVNode, render, VNode } from 'vue';

import Loading from './index.vue';

const instanceMap = new WeakMap<HTMLElement, VNode>();

const setLoading = (el: HTMLElement, visible: boolean) => {
  const vnode = instanceMap.get(el);
  if (visible) {
    vnode?.component?.exposed?.show();
  } else {
    vnode?.component?.exposed?.hide();
  }
};

export const vLoading = {
  mounted: (el: HTMLElement, binding: any) => {
    const vnode = createVNode(Loading);
    render(vnode, el);
    instanceMap.set(el, vnode);
    setLoading(el, !!binding.value);
    formatterClass(el, binding);
  },

  updated: (el: HTMLElement, binding: any) => {
    setLoading(el, !!binding.value);

    formatterClass(el, binding);
  },

  unmounted: (el: HTMLElement) => {
    render(null, el);
    instanceMap.delete(el);
  }
};

function formatterClass(el: HTMLElement, binding: any) {
  if (binding.value) {
    el.classList.add('loading-parent');
  } else {
    el.classList.remove('loading-parent');
  }
}
