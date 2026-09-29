import { createVNode, render } from 'vue';

import ShortcutToast from '@/components/ShortcutToast.vue';

let container: HTMLDivElement | null = null;
let toastInstance: any = null;

interface ToastOptions {
  position?: 'top' | 'center' | 'bottom';
  showIcon?: boolean;
}

export function showShortcutToast(message: string, iconName = '', options: ToastOptions = {}) {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
  }

  if (toastInstance) {
    render(null, container);
    toastInstance = null;
  }

  const vnode = createVNode(ShortcutToast, {
    position: options.position || 'center',
    showIcon: options.showIcon !== undefined ? options.showIcon : true,
    onDestroy: () => {
      if (container) {
        render(null, container);
        document.body.removeChild(container);
        container = null;
      }
    }
  });

  render(vnode, container);
  toastInstance = vnode.component?.exposed;

  if (toastInstance) {
    toastInstance.show(message, iconName, { showIcon: options.showIcon });
  }
}

export function showBottomToast(message: string) {
  showShortcutToast(message, '', { position: 'bottom', showIcon: false });
}
