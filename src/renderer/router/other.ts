import type { RouteRecordRaw } from 'vue-router';

const otherRouter: RouteRecordRaw[] = [
  {
    path: '/downloads',
    name: 'downloads',
    meta: {
      title: 'Download management',
      keepAlive: true,
      showInMenu: true,
      back: true,
      icon: 'ri-download-cloud-2-line'
    },
    component: () => import('@/views/download/DownloadPage.vue')
  },
  {
    path: '/playlist/:id',
    name: 'playlistDetail',
    meta: {
      title: 'Playlist',
      keepAlive: true,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/playlist/PlaylistDetail.vue'),
    props: (route) => ({ key: route.params.id })
  },
  {
    path: '/album/:id',
    name: 'albumDetail',
    meta: {
      title: 'Album',
      keepAlive: true,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/playlist/AlbumDetail.vue'),
    props: (route) => ({ key: route.params.id })
  },
  {
    path: '/mood/:id',
    name: 'moodDetail',
    meta: {
      title: 'Mood',
      keepAlive: true,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/moods/index.vue'),
    props: (route) => ({ id: route.params.id, params: route.query.params, title: route.query.title })
  },
  {
    path: '/artist/:id',
    name: 'artistDetail',
    meta: {
      title: 'Artist',
      keepAlive: true,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/artist/detail.vue'),
    props: (route) => ({ key: route.params.id })
  },
  {
    path: '/heatmap',
    name: 'heatmap',
    meta: {
      title: 'Play heat map',
      keepAlive: true,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/heatmap/index.vue')
  },
  {
    path: '/compact-search',
    name: 'compactSearch',
    meta: {
      title: 'search',
      keepAlive: false,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/compact-search/index.vue')
  },
  {
    path: '/compact-search-result',
    name: 'compactSearchResult',
    meta: {
      title: 'Search results',
      keepAlive: false,
      showInMenu: false,
      back: true
    },
    component: () => import('@/views/compact-search-result/index.vue')
  },

  {
    path: '/favorite',
    name: 'favorite',
    meta: {
      title: 'comp.homeHero.quickNav.myFavorite',
      icon: 'ri-heart-fill',
      keepAlive: true,
      back: true
    },
    component: () => import('@/views/favorite/index.vue')
  },
  {
    path: '/search-result',
    redirect: '/search'
  }
];
export default otherRouter;
