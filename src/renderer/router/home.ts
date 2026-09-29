import type { RouteRecordRaw } from 'vue-router';

const layoutRouter: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    meta: {
      title: 'comp.home',
      icon: 'icon-Home',
      keepAlive: true,
      isMobile: true
    },
    component: () => import('@/views/home/index.vue')
  },
  {
    path: '/search',
    name: 'search',
    meta: {
      title: 'comp.search',
      noScroll: true,
      icon: 'icon-Search',
      keepAlive: true
    },
    component: () => import('@/views/search/index.vue')
  },
  {
    path: '/toplist',
    name: 'toplist',
    meta: {
      title: 'comp.toplist',
      icon: 'ri-bar-chart-grouped-fill',
      keepAlive: true,
      isMobile: true
    },
    component: () => import('@/views/toplist/index.vue')
  },

  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/historyAndFavorite/index.vue'),
    meta: {
      title: 'comp.history',
      icon: 'icon-a-TicketStar',
      keepAlive: true,
      isMobile: true
    }
  },
  {
    path: '/library',
    name: 'library',
    meta: {
      title: 'comp.library',
      icon: 'ri-book-3-fill',
      keepAlive: true,
      isMobile: false
    },
    component: () => import('@/views/library/index.vue')
  },
  {
    path: '/set',
    name: 'set',
    meta: {
      title: 'comp.settings',
      icon: 'ri-settings-3-fill',
      keepAlive: true,
      noScroll: true,
      back: true
    },
    component: () => import('@/views/set/index.vue')
  }
];
export default layoutRouter;
