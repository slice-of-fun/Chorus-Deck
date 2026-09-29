<template>
  <n-modal
    v-model:show="showDisclaimer"
    preset="dialog"
    :show-icon="false"
    :closable="false"
    :mask-closable="false"
    style="width: 440px; border-radius: 20px"
  >
    <template #header>
      <div class="text-2xl font-bold text-center w-full pt-4">Terms of Use</div>
    </template>

    <div class="px-1 py-4 space-y-4 text-sm">
      <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <div class="flex items-start gap-3">
          <i class="ri-alert-line text-amber-500 text-xl flex-shrink-0 mt-0.5"></i>
          <p class="text-amber-600 dark:text-amber-400 leading-relaxed">
            This application is a development test version. Functions are not yet perfect, and there
            may be many problems and bugs. It is for learning and exchange only.
          </p>
        </div>
      </div>

      <div class="space-y-4 pt-2">
        <div class="flex items-start gap-3">
          <div
            class="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5"
          >
            <i class="ri-book-2-line text-blue-500 text-base"></i>
          </div>
          <p class="text-neutral-600 dark:text-neutral-300 leading-relaxed pt-0.5">
            This application is for personal learning, research and technical exchange only. Please
            do not use it for any commercial purposes.
          </p>
        </div>

        <div class="flex items-start gap-3">
          <div
            class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5"
          >
            <i class="ri-time-line text-primary text-base"></i>
          </div>
          <p class="text-neutral-600 dark:text-neutral-300 leading-relaxed pt-0.5">
            Please delete it within 24 hours after downloading. If you need to use it for a long
            time, please support the genuine music service.
          </p>
        </div>

        <div class="flex items-start gap-3">
          <div
            class="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5"
          >
            <i class="ri-shield-check-line text-purple-500 text-base"></i>
          </div>
          <p class="text-neutral-600 dark:text-neutral-300 leading-relaxed pt-0.5">
            By using this application, you understand and assume the relevant risks. The developer
            is not responsible for any loss.
          </p>
        </div>
      </div>
    </div>

    <template #action>
      <div class="flex flex-col gap-3 w-full pb-2">
        <n-button
          type="primary"
          size="large"
          class="w-full !rounded-xl !h-12 text-base font-medium"
          @click="handleAgree"
        >
          <template #icon>
            <i class="ri-check-line text-lg"></i>
          </template>
          I have read and agree
        </n-button>
        <n-button
          quaternary
          size="large"
          class="w-full !rounded-xl !h-11 text-neutral-500"
          @click="handleDisagree"
        >
          Disagree and Exit
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { isDesktop, isLyricWindow } from '@/utils';

const DISCLAIMER_AGREED_KEY = 'disclaimer_agreed_timestamp';

const showDisclaimer = ref(false);
const isTransitioning = ref(false);

const shouldShowDisclaimer = () => {
  return !localStorage.getItem(DISCLAIMER_AGREED_KEY);
};

const handleAgree = () => {
  if (isTransitioning.value) return;
  isTransitioning.value = true;

  localStorage.setItem(DISCLAIMER_AGREED_KEY, Date.now().toString());
  showDisclaimer.value = false;

  setTimeout(() => {
    isTransitioning.value = false;
  }, 300);
};

const handleDisagree = () => {
  if (isTransitioning.value) return;
  isTransitioning.value = true;

  if (isDesktop()) {
    window.api?.quitApp?.();
  } else {
    window.close();
  }
  isTransitioning.value = false;
};

onMounted(() => {
  if (isLyricWindow.value) return;

  if (shouldShowDisclaimer()) {
    showDisclaimer.value = true;
    return;
  }
});
</script>
