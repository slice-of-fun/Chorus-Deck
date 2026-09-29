<template>
  <div>
    <setting-section title="Listen History">
      <setting-item
        icon="ri-pause-circle-line"
        title="Pause Listen History"
        description="Stop recording newly played songs to history"
      >
        <template #action>
          <n-switch v-model:value="setData.pauseListenHistory">
            <template #checked><i class="ri-check-line"></i></template>
            <template #unchecked><i class="ri-close-line"></i></template>
          </n-switch>
        </template>
      </setting-item>

      <setting-item
        icon="ri-delete-bin-line"
        title="Clear Listen History"
        description="Delete all recorded listen history"
      >
        <template #action>
          <n-popconfirm
            @positive-click="clearListenHistory"
            positive-text="OK"
            negative-text="Cancel"
          >
            <template #trigger>
              <n-button secondary round type="error">
                <template #icon><i class="ri-delete-bin-line"></i></template>
                Clear
              </n-button>
            </template>
            Are you sure you want to clear your listen history?
          </n-popconfirm>
        </template>
      </setting-item>
    </setting-section>

    <setting-section title="Search History">
      <setting-item
        icon="ri-pause-circle-line"
        title="Pause Search History"
        description="Stop recording new searches to history"
      >
        <template #action>
          <n-switch v-model:value="setData.pauseSearchHistory">
            <template #checked><i class="ri-check-line"></i></template>
            <template #unchecked><i class="ri-close-line"></i></template>
          </n-switch>
        </template>
      </setting-item>

      <setting-item
        icon="ri-delete-bin-line"
        title="Clear Search History"
        description="Delete all recorded search history"
      >
        <template #action>
          <n-popconfirm
            @positive-click="clearSearchHistory"
            positive-text="OK"
            negative-text="Cancel"
          >
            <template #trigger>
              <n-button secondary round type="error">
                <template #icon><i class="ri-delete-bin-line"></i></template>
                Clear
              </n-button>
            </template>
            Are you sure you want to clear your search history?
          </n-popconfirm>
        </template>
      </setting-item>
    </setting-section>

    <setting-section title="Misc">
      <setting-item
        icon="ri-screenshot-line"
        title="Disable Screenshot"
        description="Prevent screenshots and screen recording"
      >
        <template #action>
          <n-switch v-model:value="setData.disableScreenshot">
            <template #checked><i class="ri-check-line"></i></template>
            <template #unchecked><i class="ri-close-line"></i></template>
          </n-switch>
        </template>
      </setting-item>
    </setting-section>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue';

import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';

const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

const clearListenHistory = () => {
  // Add logic to clear listen history in the database/store here
  message.success('Listen history cleared successfully');
};

const clearSearchHistory = () => {
  // Add logic to clear search history in the database/store here
  message.success('Search history cleared successfully');
};
</script>
