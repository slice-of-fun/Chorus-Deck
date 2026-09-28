import './index.css';
import '@/assets/css/mobile.css';
import 'animate.css';
import 'remixicon/fonts/remixicon.css';

import { createApp } from 'vue';

import router from '@/router';
import pinia from '@/store';
import { isElectron } from '@/utils';

import App from './App.vue';
import directives from './directive';

const app = createApp(App);

Object.keys(directives).forEach((key: string) => {
  app.directive(key, directives[key as keyof typeof directives]);
});

app.use(pinia);
app.use(router);

app.mount('#app');
