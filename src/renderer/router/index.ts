import { createRouter, createWebHashHistory } from 'vue-router';

import AppLayout from '@/layout/AppLayout.vue';
import homeRouter from '@/router/home';
import otherRouter from '@/router/other';
import { useSettingsStore } from '@/store/modules/settings';

let _settingsStore: ReturnType<typeof useSettingsStore> | null = null;
const getSettingsStore = () => {
  if (!_settingsStore) {
    _settingsStore = useSettingsStore();
  }
  return _settingsStore;
};

const routes = [
  {
    path: '/',
    component: AppLayout,
    children: [...homeRouter, ...otherRouter]
  },
  {
    path: '/lyric',
    component: () => import('@/views/lyric/index.vue')
  },
  {
    path: '/dynamic-island',
    component: () => import('@/views/dynamic-island/index.vue')
  }
];

const router = createRouter({
  routes,
  history: createWebHashHistory()
});

router.beforeEach((to, _, next) => {
  if (to.path === '/dynamic-island') {
    next();
    return;
  }

  next();
});

export default router;
