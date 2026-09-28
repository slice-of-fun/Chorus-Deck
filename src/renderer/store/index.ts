import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { markRaw } from 'vue';

import router from '@/router';

const pinia = createPinia();

pinia.use(piniaPluginPersistedstate);

pinia.use(({ store }) => {
  store.router = markRaw(router);
});

export * from './modules/download';
export * from './modules/favorite';
export * from './modules/localMusic';
export * from './modules/menu';
export * from './modules/music';
export * from './modules/navTitle';
export * from './modules/player';
export * from './modules/playerCore';
export * from './modules/playHistory';
export * from './modules/playlist';
export * from './modules/search';
export * from './modules/settings';

export default pinia;
