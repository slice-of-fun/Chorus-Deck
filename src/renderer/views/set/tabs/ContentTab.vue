<template>
  <setting-section v-if="isDesktop()" title="Application Settings">
    <setting-item icon="ri-close-circle-line" title="Close Action" description="Choose action when closing window">
      <s-select
        v-model="setData.closeAction"
        :options="closeActionOptions"
        width="w-40 max-md:w-full"
      />
    </setting-item>

    <setting-item v-if="isDesktop()" icon="ri-download-cloud-2-line" title="Download Management">
      <template #description>
        <n-switch v-model:value="setData.alwaysShowDownloadButton" class="mr-2">
          <template #checked>Show</template>
          <template #unchecked>Hide</template>
        </n-switch>
        Always show download list button
      </template>
      <s-btn @click="router.push('/downloads')"> Download Management </s-btn>
    </setting-item>

    <setting-item icon="ri-infinity-line" title="Unlimited Download">
      <template #description>
        <n-switch v-model:value="setData.unlimitedDownload" class="mr-2">
          <template #checked>On</template>
          <template #unchecked>Off</template>
        </n-switch>
        Enable unlimited download mode for music , default limit 300 songs
      </template>
    </setting-item>

    <setting-item icon="ri-folder-download-line" title="Download Directory">
      <template #description>
        <span class="break-all">{{
          setData.downloadPath || 'Choose download location for music files'
        }}</span>
      </template>
      <template #action>
        <div class="flex items-center gap-2">
          <s-btn @click="openDownloadPath">Open</s-btn>
          <s-btn @click="selectDownloadPath">Modify</s-btn>
        </div>
      </template>
    </setting-item>
  </setting-section>

  <setting-section title="General Content Settings">
    <setting-item icon="ri-translate-2" title="Content Language" description="Select the language for content">
      <n-input v-model:value="setData.contentLanguage" placeholder="system" />
    </setting-item>

    <setting-item icon="ri-map-pin-line" title="Content Country" description="Select the country for content">
      <n-input v-model:value="setData.contentCountry" placeholder="system" />
    </setting-item>

    <setting-item icon="ri-map-pin-2-line" title="Suggestions Region" description="Select the region for suggestions">
      <n-input v-model:value="setData.suggestionRegion" placeholder="system" />
    </setting-item>

    <setting-item icon="ri-eye-close-line" title="Hide Explicit" description="Hide explicit content">
      <n-switch v-model:value="setData.hideExplicit" />
    </setting-item>

    <setting-item icon="ri-video-off-line" title="Hide Video Songs" description="Hide video songs">
      <n-switch v-model:value="setData.hideVideoSongs" />
    </setting-item>

    <setting-item icon="ri-video-off-fill" title="Hide YouTube Shorts" description="Hide YouTube Shorts in search results">
      <n-switch v-model:value="setData.hideYoutubeShorts" />
    </setting-item>

    <setting-item icon="ri-skip-forward-line" title="SponsorBlock" description="Skip sponsors, intro, outro, etc.">
      <n-switch v-model:value="setData.sponsorBlockEnabled" />
    </setting-item>
  </setting-section>

  <setting-section title="Artist Page Settings">
    <setting-item icon="ri-file-text-line" title="Show Artist Description" description="Show description on artist page">
      <n-switch v-model:value="setData.showArtistDescription" />
    </setting-item>

    <setting-item
      icon="ri-user-follow-line" title="Show Artist Subscriber Count"
      description="Show subscriber count on artist page"
    >
      <n-switch v-model:value="setData.showArtistSubscriberCount" />
    </setting-item>

    <setting-item
      icon="ri-headphone-line" title="Show Monthly Listeners"
      description="Show monthly listeners on artist page"
    >
      <n-switch v-model:value="setData.showMonthlyListeners" />
    </setting-item>

    <setting-item icon="ri-video-line" title="Show Artist Video" description="Show videos on artist page">
      <n-switch v-model:value="setData.showArtistVideo" />
    </setting-item>

    <setting-item
      icon="ri-image-edit-line" title="Show Artist Background Video"
      description="Show background video on artist page"
    >
      <n-switch v-model:value="setData.showArtistBackgroundVideo" />
    </setting-item>
  </setting-section>

  <setting-section title="Other Content Settings">
    <setting-item icon="ri-flashlight-line" title="Set Quick Picks" description="Select quick picks mode">
      <s-select v-model="setData.quickPicks" :options="quickPicksOptions" width="w-40" />
    </setting-item>

    <setting-item icon="ri-list-ordered" title="Top Length" description="Number of items for top lists">
      <n-input v-model:value="setData.lengthTop" />
    </setting-item>

    <setting-item icon="ri-global-line" title="Network IP Version" description="Select preferred IP version">
      <s-select v-model="setData.ipVersion" :options="ipVersionOptions" width="w-40" />
    </setting-item>

    <setting-item
      icon="ri-shuffle-line" title="Randomize Home Order"
      description="Randomize the order of items on the home page"
    >
      <n-switch v-model:value="setData.randomizeHomeOrder" />
    </setting-item>

    <setting-item icon="ri-speed-mini-fill" title="Show Speed Dial" description="Show speed dial on home page">
      <n-switch v-model:value="setData.showSpeedDial" />
    </setting-item>

    <setting-item icon="ri-album-line" title="Enable Album Canvas" description="Show Spotify album canvas if available">
      <n-switch v-model:value="setData.albumCanvasEnabled" />
    </setting-item>
  </setting-section>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import { useRouter } from 'vue-router';

import { isDesktop } from '@/utils';
import { openDirectory, selectDirectory } from '@/utils/fileOperation';

import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SSelect from '../SSelect.vue';

const router = useRouter();
const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

const closeActionOptions = computed(() => [
  { label: 'Ask Every Time', value: 'ask' },
  { label: 'Minimize to Tray', value: 'minimize' },
  { label: 'Exit Directly', value: 'close' }
]);

const quickPicksOptions = computed(() => [
  { label: 'Quick Picks', value: 'QUICK_PICKS' },
  { label: 'Last Song Listened', value: 'LAST_LISTEN' }
]);

const ipVersionOptions = computed(() => [
  { label: 'Auto', value: 'AUTO' },
  { label: 'IPv4', value: 'IPV4' },
  { label: 'IPv6', value: 'IPV6' }
]);

const selectDownloadPath = async () => {
  const path = await selectDirectory(message);
  if (path) {
    setData.value = { ...setData.value, downloadPath: path };
  }
};

const openDownloadPath = () => {
  openDirectory(setData.value.downloadPath, message);
};
</script>
