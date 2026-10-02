<template>
  <div
    id="title-bar"
    class="flex items-center justify-between pl-4 pr-2 py-1 select-none relative text-dark dark:text-white text-sm"
    @mousedown="drag"
  >
    <div id="title" class="font-medium">Chorus Deck</div>
    <div id="buttons" class="flex items-center gap-1.5" @mousedown.stop>
      <n-button
        v-if="!isDesktop()"
        type="primary"
        size="small"
        text
        title="Download app"
        @click="openDownloadPage"
      >
        <i class="ri-download-line"></i>
        Download desktop version
      </n-button>
      <template v-if="isDesktop()">
        <div class="window-control-btn" @click="miniWindow" title="Mini Window">
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <rect x="7" y="7" width="6" height="5" rx="1" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div class="window-control-btn" @click="minimize" title="Minimize">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 8h10v1.5H3z" />
          </svg>
        </div>
        <div class="window-control-btn" @click="maximize" title="Maximize">
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="3" y="3" width="10" height="10" rx="1.5" />
          </svg>
        </div>
        <div class="window-control-btn close-btn" @click="handleClose" title="Close">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M4.29 4.29a1 1 0 0 1 1.42 0L8 6.59l2.29-2.3a1 1 0 0 1 1.42 1.42L9.41 8l2.3 2.29a1 1 0 0 1-1.42 1.42L8 9.41l-2.29 2.3a1 1 0 0 1-1.42-1.42L6.59 8 4.29 5.71a1 1 0 0 1 0-1.42z"
            />
          </svg>
        </div>
      </template>
    </div>
  </div>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showCloseModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showCloseModal = false"
      >
        <div
          class="relative w-[360px] transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
        >
          <button
            class="absolute top-4 right-4 p-1 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors focus:outline-none"
            @click="showCloseModal = false"
          >
            <i class="ri-close-line text-xl leading-none"></i>
          </button>

          <h3 class="text-lg font-bold leading-6 text-neutral-900 dark:text-white mb-2">
            Close App
          </h3>
          <div class="mt-2">
            <p class="text-sm text-neutral-500 dark:text-neutral-400">Choose how to close</p>
          </div>

          <div
            class="mt-4 flex w-fit cursor-pointer items-center gap-2 group"
            @click="rememberChoice = !rememberChoice"
          >
            <div
              class="relative flex h-5 w-5 items-center justify-center transition-colors duration-200"
              :class="
                rememberChoice
                  ? '-primary'
                  : 'text-neutral-400 group-hover:text-neutral-500 dark:text-neutral-500 dark:group-hover:text-neutral-400'
              "
            >
              <i
                class="text-xl"
                :class="
                  rememberChoice ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'
                "
              ></i>
            </div>
            <span
              class="select-none text-xs text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-300"
              :class="{ 'text-neutral-800 dark:text-neutral-200': rememberChoice }"
            >
              Remember my choice
            </span>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-full px-4 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-colors focus:outline-none"
              @click="showCloseModal = false"
            >
              Cancel
            </button>
            <button
              class="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors focus:outline-none"
              @click="handleAction('close')"
            >
              Exit App
            </button>
            <button
              class="rounded-full text-primary px-6 py-2 text-sm font-medium text-white hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:text-primary focus-visible:ring-offset-2 transition-colors shadow-lg text-primary/20"
              @click="handleAction('minimize')"
            >
              Minimize to Tray
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { useSettingsStore } from '@/store/modules/settings';
import { isDesktop } from '@/utils';

const settingsStore = useSettingsStore();
const router = useRouter();
const showCloseModal = ref(false);
const rememberChoice = ref(false);

const openDownloadPage = () => {
  if (!isDesktop()) {
    window.open('https://github.com/Chorus-Deck/Chorus-Deck/releases', '_blank');
  }
};

const minimize = () => {
  if (!isDesktop()) {
    return;
  }
  window.api.minimize();
};

const maximize = () => {
  if (!isDesktop()) {
    return;
  }
  window.api.maximize();
};

const miniWindow = () => {
  if (!isDesktop()) return;
  settingsStore.setMiniMode(true);
  router.push('/mini');
  window.api.setMiniConstraints(true);
};

const handleAction = (action: 'minimize' | 'close') => {
  if (rememberChoice.value) {
    settingsStore.setSetData({
      ...settingsStore.setData,
      closeAction: action
    });
  }

  if (action === 'minimize') {
    showCloseModal.value = false;
    setTimeout(() => {
      window.api.miniTray();
    }, 200);
  } else {
    window.api.quitApp();
    showCloseModal.value = false;
  }
};

const handleClose = () => {
  const { closeAction } = settingsStore.setData;

  if (closeAction === 'minimize') {
    window.api.miniTray();
  } else if (closeAction === 'close') {
    window.api.close();
  } else {
    showCloseModal.value = true;
  }
};

const drag = (event: MouseEvent) => {
  if (!isDesktop()) {
    return;
  }
  window.api.dragStart(event as unknown as string);
};
</script>

<style scoped lang="scss">
#title-bar {
  -webkit-app-region: drag;
  z-index: 3000;
}

#buttons {
  -webkit-app-region: no-drag;
}

.window-control-btn {
  @apply flex items-center justify-center w-9 h-7 rounded-lg transition-colors duration-150 cursor-pointer;
  @apply text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100;
  @apply hover:bg-black/5 dark:hover:bg-white/10;
}

.close-btn {
  @apply hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white;
}
</style>
