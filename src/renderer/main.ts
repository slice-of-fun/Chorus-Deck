import './index.css';
import '@/assets/css/compact.css';
import 'animate.css';
import 'remixicon/fonts/remixicon.css';

import { createApp } from 'vue';

import { installBridge } from '@/api/bridge';
import router from '@/router';
import pinia from '@/store';

import App from './App.vue';
import directives from './directive';

installBridge();

const app = createApp(App);

Object.keys(directives).forEach((key: string) => {
  app.directive(key, directives[key as keyof typeof directives]);
});

app.use(pinia);
app.use(router);

app.mount('#app');
