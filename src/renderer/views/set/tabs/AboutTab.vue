<template>
  <setting-section title="About">
    <!-- App Card -->
    <div
      class="flex flex-col items-center justify-center p-6 bg-surface-container-low rounded-3xl mb-6"
    >
      <div
        class="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center cursor-pointer transition-transform duration-500"
        :class="{ 'rotate-y-180': isEasterEggActive }"
        @click="isEasterEggActive = !isEasterEggActive"
      >
        <img v-if="!isEasterEggActive" src="@/assets/logo.png" alt="Logo" class="w-16 h-16" />
        <img
          v-else
          src="https://github.com/pushkarverse.png"
          alt="Developer"
          class="w-full h-full rounded-full object-cover"
        />
      </div>
      <div class="mt-4 text-xl font-bold">
        {{ !isEasterEggActive ? 'Chorus Deck' : 'Developed by pushkar' }}
      </div>
      <div class="flex items-center gap-2 mt-2">
        <div class="px-2 py-1 text-xs font-medium text-primary bg-primary/10 rounded-md">
          {{ updateInfo.currentVersion }}
        </div>
      </div>
    </div>

    <setting-item icon="ri-information-line" title="Version">
      <template #description>
        <div class="flex flex-wrap items-center gap-2">
          <span>{{ updateInfo.currentVersion }}</span>
          <n-tag v-if="updateInfo.hasUpdate" type="success">
            New version available {{ updateInfo.latestVersion }}
          </n-tag>
        </div>
        <div v-if="hasManualUpdateFallback" class="mt-2 text-xs text-amber-600">
          <i class="ri-information-line mr-1"></i>
          {{ appUpdateState.errorMessage || 'Failed to check for updates, please try again later' }}
        </div>
      </template>
      <template #action>
        <div class="flex items-center gap-2 flex-wrap">
          <s-btn :loading="checking" @click="checkForUpdates(true)">
            {{ checking ? 'Checking...' : 'Check for Updates' }}
          </s-btn>
          <s-btn v-if="updateInfo.hasUpdate" variant="primary" @click="openReleasePage">
            Go to Update
          </s-btn>
          <s-btn v-if="hasManualUpdateFallback" variant="ghost" @click="openManualUpdatePage">
            Manual Update
          </s-btn>
        </div>
      </template>
    </setting-item>

    <setting-item
      icon="ri-user-line"
      title="Developer"
      description="pushkar"
      clickable
      @click="openDeveloper"
    >
      <s-btn @click.stop="openDeveloper"> <i class="ri-github-line mr-1"></i>GitHub </s-btn>
    </setting-item>

    <setting-item
      icon="ri-github-line"
      title="App"
      description="slice-of-fun/Chorus-Music"
      clickable
      @click="openAppRepo"
    >
      <s-btn @click.stop="openAppRepo"> <i class="ri-github-line mr-1"></i>GitHub </s-btn>
    </setting-item>
  </setting-section>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';
import { isDesktop } from '@/utils';
import { checkUpdate, UpdateResult } from '@/utils/update';

import config from '../../../../../package.json';
import { APP_UPDATE_STATUS, hasAvailableAppUpdate } from '../../../../shared/appUpdate';
import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';

const settingsStore = useSettingsStore();
const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

const isEasterEggActive = ref(false);
const checking = ref(false);
const webUpdateInfo = ref<UpdateResult>({
  hasUpdate: false,
  latestVersion: '',
  currentVersion: config.version,
  releaseInfo: null
});

const appUpdateState = computed(() => settingsStore.appUpdateState);
const hasAppUpdate = computed(() => hasAvailableAppUpdate(appUpdateState.value));
const hasManualUpdateFallback = computed(
  () => isDesktop() && appUpdateState.value.status === APP_UPDATE_STATUS.error
);

const updateInfo = computed<UpdateResult>(() => {
  if (!isDesktop()) {
    return webUpdateInfo.value;
  }

  return {
    hasUpdate: hasAppUpdate.value,
    latestVersion: appUpdateState.value.availableVersion ?? '',
    currentVersion: appUpdateState.value.currentVersion || config.version,
    releaseInfo: appUpdateState.value.availableVersion
      ? {
          tag_name: appUpdateState.value.availableVersion,
          body: appUpdateState.value.releaseNotes,
          html_url: appUpdateState.value.releasePageUrl,
          assets: []
        }
      : null
  };
});

const checkForUpdates = async (isClick = false) => {
  checking.value = true;
  try {
    if (isDesktop()) {
      const result = await window.api.checkAppUpdate(isClick);
      settingsStore.setAppUpdateState(result);

      if (hasAvailableAppUpdate(result)) {
        if (isClick) {
          settingsStore.setShowUpdateModal(true);
        }
      } else if (result.status === APP_UPDATE_STATUS.notAvailable && isClick) {
        message.success('Already latest version');
      } else if (result.status === APP_UPDATE_STATUS.error && isClick) {
        message.error(result.errorMessage || 'Failed to check for updates, please try again later');
      }

      return;
    }

    const result = await checkUpdate(config.version);
    if (result) {
      webUpdateInfo.value = result;
      if (!result.hasUpdate && isClick) {
        message.success('Already latest version');
      }
    } else if (isClick) {
      message.success('Already latest version');
    }
  } catch (error) {
    console.error('Check for updates failed:', error);
    if (isClick) {
      message.error('Failed to check for updates, please try again later');
    }
  } finally {
    checking.value = false;
  }
};

const openReleasePage = () => {
  if (isDesktop()) {
    settingsStore.setShowUpdateModal(true);
    return;
  }

  window.open(updateInfo.value.releaseInfo?.html_url || setData.value.authorUrl);
};

const openManualUpdatePage = async () => {
  if (isDesktop()) {
    await window.api.openAppUpdatePage();
    return;
  }

  window.open(updateInfo.value.releaseInfo?.html_url || setData.value.authorUrl);
};

const openDeveloper = () => {
  window.open('https://github.com/pushkarverse');
};

const openAppRepo = () => {
  window.open('https://github.com/slice-of-fun/Chorus-Music');
};

defineExpose({ checkForUpdates });
</script>
