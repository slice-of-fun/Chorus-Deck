<template>
  <div>
    <!-- Account -->
    <setting-section title="Account">
      <!-- Outer Card -->
      <div class="flex flex-col p-5 rounded-3xl bg-black/5 dark:bg-[#1a1b1e] mb-4 space-y-4 shadow-sm">
        <!-- User Info Row -->
        <div class="flex items-center space-x-4">
          <!-- Avatar with Glow -->
          <div class="relative">
            <div class="absolute inset-0 rounded-full shadow-[0_0_30px_rgba(88,101,242,0.56)] bg-[#5865F2]" v-if="setData.discordToken"></div>
            <div class="relative w-[88px] h-[88px] rounded-full bg-black/10 dark:bg-[#2b2d31] flex items-center justify-center overflow-hidden z-10 border-[4px] border-[#1a1b1e] dark:border-[#2b2d31]">
              <img
                v-if="setData.discordToken && setData.discordAvatarUrl"
                :src="setData.discordAvatarUrl"
                alt="Avatar"
                class="w-full h-full object-cover"
              />
              <n-icon v-else size="40" class="text-black/50 dark:text-white/50">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.33-.35-.76-.53-1.09a.09.09 0 0 0-.07-.03c-1.5.26-2.93.71-4.27 1.33a.08.08 0 0 0-.05.05C2.79 11.5 1.41 17.28 1.88 23a.08.08 0 0 0 .04.06c1.81 1.32 3.53 2.12 5.24 2.65a.09.09 0 0 0 .1-.03c.41-.56.77-1.15 1.1-1.76a.08.08 0 0 0-.04-.11 11.81 11.81 0 0 1-1.66-.79.08.08 0 0 1-.01-.13c.12-.09.23-.18.35-.27a.08.08 0 0 1 .08-.01c3.53 1.61 7.36 1.61 10.86 0a.08.08 0 0 1 .08.01c.12.09.23.18.35.27a.08.08 0 0 1-.01.13 11.81 11.81 0 0 1-1.66.79.08.08 0 0 0-.04.11c.33.61.69 1.2 1.1 1.76a.09.09 0 0 0 .1.03c1.71-.53 3.43-1.33 5.24-2.65a.08.08 0 0 0 .04-.06c.55-6.53-1.28-12.24-2.81-17.62a.08.08 0 0 0-.05-.05zM8.02 15.33c-1.18 0-2.15-1.08-2.15-2.41s.95-2.41 2.15-2.41c1.21 0 2.16 1.09 2.15 2.41 0 1.33-.95 2.41-2.15 2.41zm7.97 0c-1.18 0-2.15-1.08-2.15-2.41s.95-2.41 2.15-2.41c1.21 0 2.16 1.09 2.15 2.41 0 1.33-.94 2.41-2.15 2.41z"/></svg>
              </n-icon>
            </div>
          </div>
          
          <div class="flex flex-col">
            <span class="text-[22px] font-bold">{{ setData.discordName || setData.discordUsername || 'Account' }}</span>
            <span v-if="setData.discordUsername" class="text-base text-primary font-medium">@{{ setData.discordUsername }}</span>
          </div>
        </div>

        <!-- Session Status -->
        <div class="rounded-2xl p-3.5 px-4 flex items-center space-x-3 transition-colors" :class="setData.discordToken ? 'bg-primary/20 text-primary' : 'bg-black/5 dark:bg-white/10'">
          <n-icon size="20" :class="setData.discordToken ? 'text-primary' : 'text-black/60 dark:text-white/60'">
            <svg v-if="setData.discordToken" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.33-.35-.76-.53-1.09a.09.09 0 0 0-.07-.03c-1.5.26-2.93.71-4.27 1.33a.08.08 0 0 0-.05.05C2.79 11.5 1.41 17.28 1.88 23a.08.08 0 0 0 .04.06c1.81 1.32 3.53 2.12 5.24 2.65a.09.09 0 0 0 .1-.03c.41-.56.77-1.15 1.1-1.76a.08.08 0 0 0-.04-.11 11.81 11.81 0 0 1-1.66-.79.08.08 0 0 1-.01-.13c.12-.09.23-.18.35-.27a.08.08 0 0 1 .08-.01c3.53 1.61 7.36 1.61 10.86 0a.08.08 0 0 1 .08.01c.12.09.23.18.35.27a.08.08 0 0 1-.01.13 11.81 11.81 0 0 1-1.66.79.08.08 0 0 0-.04.11c.33.61.69 1.2 1.1 1.76a.09.09 0 0 0 .1.03c1.71-.53 3.43-1.33 5.24-2.65a.08.08 0 0 0 .04-.06c.55-6.53-1.28-12.24-2.81-17.62a.08.08 0 0 0-.05-.05zM8.02 15.33c-1.18 0-2.15-1.08-2.15-2.41s.95-2.41 2.15-2.41c1.21 0 2.16 1.09 2.15 2.41 0 1.33-.95 2.41-2.15 2.41zm7.97 0c-1.18 0-2.15-1.08-2.15-2.41s.95-2.41 2.15-2.41c1.21 0 2.16 1.09 2.15 2.41 0 1.33-.94 2.41-2.15 2.41z"/></svg>
          </n-icon>
          <span class="text-[15px] font-medium">{{ setData.discordToken ? 'Discord account ready' : 'Log in to show what you\'re listening to on Discord' }}</span>
        </div>

        <!-- Enable RPC Toggle inside Account Card -->
        <div :class="['w-full rounded-2xl p-4 flex items-center justify-between transition-colors', (setData.discordRPCEnabled && setData.discordToken) ? 'bg-primary/20' : 'bg-black/5 dark:bg-white/10']">
          <div class="flex items-center space-x-4">
            <div class="w-11 h-11 rounded-lg bg-background flex items-center justify-center">
              <n-icon size="24" class="text-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              </n-icon>
            </div>
            <span class="text-[17px] font-semibold">Enable Discord RPC</span>
          </div>
          <n-switch v-model:value="setData.discordRPCEnabled" size="large" />
        </div>

        <div v-if="!setData.discordToken" class="flex flex-col space-y-4 mt-2">
          <n-button
            size="large"
            block
            class="h-[60px] text-[16px] font-bold rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white border-none shadow-[0_8px_16px_rgba(88,101,242,0.24)] transition-all hover:shadow-[0_12px_20px_rgba(88,101,242,0.32)] hover:-translate-y-0.5"
            @click="loginDiscordWebView"
          >
            <template #icon>
              <n-icon size="24"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.33-.35-.76-.53-1.09a.09.09 0 0 0-.07-.03c-1.5.26-2.93.71-4.27 1.33a.08.08 0 0 0-.05.05C2.79 11.5 1.41 17.28 1.88 23a.08.08 0 0 0 .04.06c1.81 1.32 3.53 2.12 5.24 2.65a.09.09 0 0 0 .1-.03c.41-.56.77-1.15 1.1-1.76a.08.08 0 0 0-.04-.11 11.81 11.81 0 0 1-1.66-.79.08.08 0 0 1-.01-.13c.12-.09.23-.18.35-.27a.08.08 0 0 1 .08-.01c3.53 1.61 7.36 1.61 10.86 0a.08.08 0 0 1 .08.01c.12.09.23.18.35.27a.08.08 0 0 1-.01.13 11.81 11.81 0 0 1-1.66.79.08.08 0 0 0-.04.11c.33.61.69 1.2 1.1 1.76a.09.09 0 0 0 .1.03c1.71-.53 3.43-1.33 5.24-2.65a.08.08 0 0 0 .04-.06c.55-6.53-1.28-12.24-2.81-17.62a.08.08 0 0 0-.05-.05zM8.02 15.33c-1.18 0-2.15-1.08-2.15-2.41s.95-2.41 2.15-2.41c1.21 0 2.16 1.09 2.15 2.41 0 1.33-.95 2.41-2.15 2.41zm7.97 0c-1.18 0-2.15-1.08-2.15-2.41s.95-2.41 2.15-2.41c1.21 0 2.16 1.09 2.15 2.41 0 1.33-.94 2.41-2.15 2.41z"/></svg></n-icon>
            </template>
            Log in to Discord
          </n-button>
        </div>

        <!-- Action Button -->
        <n-button
          v-if="setData.discordToken"
          size="large"
          block
          secondary
          class="h-14 font-semibold text-[15px] rounded-full mt-2 border-2 border-primary/50 text-primary hover:bg-primary/10"
          @click="logoutDiscord"
        >
          Logout
        </n-button>
      </div>
    </setting-section>

    <!-- Options -->
    <setting-section title="Options">
      <setting-item title="Refresh" description="Force refresh Discord Rich Presence">
        <template #action>
          <n-button :disabled="!setData.discordRPCEnabled || !setData.discordToken" @click="refreshDiscord">
            Refresh
          </n-button>
        </template>
      </setting-item>

    </setting-section>

    <!-- Discord Connection Settings -->
    <setting-section title="Discord Connection Settings" :class="{ 'opacity-50 pointer-events-none': !setData.discordRPCEnabled }">
      <list-dialog-preference
        title="Activity Status"
        
        description="Your online status on Discord"
        v-model:value="setData.discordPresenceStatus"
        :options="statusOptions"
      >
        <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></template>
      </list-dialog-preference>

      <list-dialog-preference
        title="Platform Status"
        
        description="The platform shown on Discord"
        v-model:value="setData.discordActivityPlatform"
        :options="platformOptions"
      >
        <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></template>
      </list-dialog-preference>
    </setting-section>

    <!-- Activity Content -->
    <setting-section title="Discord Activity Content" :class="{ 'opacity-50 pointer-events-none': !setData.discordRPCEnabled }">
      <list-dialog-preference
        title="Activity Name"
        
        description="The name of the activity"
        v-model:value="setData.discordActivityName"
        :options="sourceOptions"
      >
        <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></template>
      </list-dialog-preference>

      <list-dialog-preference
        title="Activity Details"
        
        description="What to show on the first line"
        v-model:value="setData.discordActivityDetails"
        :options="sourceOptions"
      >
        <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></template>
      </list-dialog-preference>

      <list-dialog-preference
        title="Activity State"
        
        description="What to show on the second line"
        v-model:value="setData.discordActivityState"
        :options="sourceOptions"
      >
        <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></template>
      </list-dialog-preference>

      <setting-item title="Show When Paused"
         description="Keep Rich Presence active when playback is paused">
        <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg></template>

        <n-switch v-model:value="setData.discordShowWhenPaused" />
      </setting-item>

      <list-dialog-preference
        title="Activity Type"
        
        description="How the activity is displayed"
        v-model:value="setData.discordActivityType"
        :options="activityTypeOptions"
      >
        <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.33-.35-.76-.53-1.09a.09.09 0 0 0-.07-.03c-1.5.26-2.93.71-4.27 1.33a.08.08 0 0 0-.05.05C2.79 11.5 1.41 17.28 1.88 23a.08.08 0 0 0 .04.06c1.81 1.32 3.53 2.12 5.24 2.65a.09.09 0 0 0 .1-.03c.41-.56.77-1.15 1.1-1.76a.08.08 0 0 0-.04-.11 11.81 11.81 0 0 1-1.66-.79.08.08 0 0 1-.01-.13c.12-.09.23-.18.35-.27a.08.08 0 0 1 .08-.01c3.53 1.61 7.36 1.61 10.86 0a.08.08 0 0 1 .08.01c.12.09.23.18.35.27a.08.08 0 0 1-.01.13 11.81 11.81 0 0 1-1.66.79.08.08 0 0 0-.04.11c.33.61.69 1.2 1.1 1.76a.09.09 0 0 0 .1.03c1.71-.53 3.43-1.33 5.24-2.65a.08.08 0 0 0 .04-.06c.55-6.53-1.28-12.24-2.81-17.62a.08.08 0 0 0-.05-.05zM8.02 15.33c-1.18 0-2.15-1.08-2.15-2.41s.95-2.41 2.15-2.41c1.21 0 2.16 1.09 2.15 2.41 0 1.33-.95 2.41-2.15 2.41zm7.97 0c-1.18 0-2.15-1.08-2.15-2.41s.95-2.41 2.15-2.41c1.21 0 2.16 1.09 2.15 2.41 0 1.33-.94 2.41-2.15 2.41z"/></svg></template>
      </list-dialog-preference>
    </setting-section>

    <!-- Images -->
    <setting-section title="Discord Image Options" :class="{ 'opacity-50 pointer-events-none': !setData.discordRPCEnabled }">
      <list-dialog-preference
        title="Large Image"
        
        description="The main image displayed"
        v-model:value="setData.discordLargeImageType"
        :options="imageTypeOptions"
      >
        <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></template>
      </list-dialog-preference>
      <setting-item v-if="setData.discordLargeImageType === 'custom'" title="Large Image Custom URL"
         description="URL for the large image">
        <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></template>

        <template #action>
          <s-input v-model="setData.discordLargeImageCustomUrl" type="text" width="w-[200px]" placeholder="https://..." />
        </template>
      </setting-item>

      <list-dialog-preference
        title="Small Image"
        
        description="The secondary small image"
        v-model:value="setData.discordSmallImageType"
        :options="smallImageTypeOptions"
      >
        <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></template>
      </list-dialog-preference>

      <setting-item v-if="setData.discordSmallImageType === 'custom'" title="Small Image Custom URL"
         description="URL for the small image">
        <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></template>

        <template #action>
          <s-input v-model="setData.discordSmallImageCustomUrl" type="text" width="w-[200px]" placeholder="https://..." />
        </template>
      </setting-item>
    </setting-section>



    <!-- Preview -->
    <div class="mt-8 mb-4 flex justify-center w-full" :class="{ 'opacity-50 pointer-events-none': !setData.discordRPCEnabled }">
      <div class="p-6 rounded-[24px] bg-[#2b2d31] text-[#dbdee1] font-sans flex flex-col w-[420px] mt-2 mb-8 shadow-lg scale-105 origin-top">
        <div class="text-[12px] font-bold uppercase mb-3 text-[#b5bac1]">{{ activityTypeHeader }}</div>
        
        <div class="flex items-start space-x-4">
          <div class="relative w-[72px] h-[72px] flex-shrink-0">
            <div :class="['w-full h-full rounded-[8px] bg-[#1e1f22] overflow-hidden flex items-center justify-center', !largeImagePreview ? 'border-2 border-[#dbdee1]' : '']">
              <img v-if="largeImagePreview" 
                   class="w-full h-full object-cover" 
                   :src="largeImagePreview" 
                   alt="Large Image" />
            </div>
            <div v-if="setData.discordSmallImageType !== 'dontshow' && smallImagePreview" class="w-8 h-8 rounded-full border-[3px] border-[#2b2d31] absolute -bottom-1.5 -right-1.5 bg-[#1e1f22] overflow-hidden flex items-center justify-center">
              <img class="w-full h-full object-cover" 
                   :src="smallImagePreview" 
                   alt="Small Image" />
            </div>
          </div>
          
          <div class="flex flex-col flex-1 overflow-hidden min-w-0">
            <span class="font-extrabold text-[#f2f3f5] truncate text-[14px] leading-tight mb-0.5">Chorus Deck</span>
            <span class="text-[14px] text-[#dbdee1] truncate leading-snug">{{ previewName || getPlaceholderText(setData.discordActivityName) }}</span>
            <span class="text-[14px] text-[#dbdee1] truncate leading-snug">{{ previewDetails || getPlaceholderText(setData.discordActivityDetails) }}</span>
            <span class="text-[14px] text-[#dbdee1] truncate leading-snug">{{ previewState || getPlaceholderText(setData.discordActivityState) }}</span>
          </div>
        </div>
        
        <div class="mt-4 flex flex-col space-y-2">
          <div class="w-full bg-[#4e5058] hover:bg-[#6d6f78] text-[#dbdee1] text-[14px] font-medium py-2 rounded-[4px] text-center cursor-pointer transition-colors">
            Listen on Chorus
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue';
import { NSwitch, NSelect, NButton, NAvatar } from 'naive-ui';

import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SInput from '../SInput.vue';
import ListDialogPreference from '../ListDialogPreference.vue';

const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

import { ref } from 'vue';
import { useSettingsStore } from '@/store/modules/settings';

const settingsStore = useSettingsStore();
const tempDiscordToken = ref('');

const loginDiscordWebView = async () => {
  try {
    const userInfo = await window.api.invoke<{
      token: string;
      username?: string;
      name?: string;
      avatarUrl?: string;
    } | null>('discord-webview-login');
    if (userInfo && userInfo.token) {
      // Persist immediately via the settings store (no debounce race)
      settingsStore.setSetData({
        discordToken: userInfo.token,
        discordUsername: userInfo.username || '',
        discordName: userInfo.name || userInfo.username || '',
        discordAvatarUrl: userInfo.avatarUrl || ''
      });

      // Update local reactive setData so the UI reflects the change instantly
      setData.value = {
        ...setData.value,
        discordToken: userInfo.token,
        discordUsername: userInfo.username || '',
        discordName: userInfo.name || userInfo.username || '',
        discordAvatarUrl: userInfo.avatarUrl || ''
      };

      message.success('Connected to Discord!');
    }
  } catch (error: any) {
    if (error?.message !== 'Window closed before login') {
      console.error('Failed to login to Discord:', error);
      message.error('Discord login failed. Please try again.');
    }
  }
};

const logoutDiscord = () => {
  // Immediately persist the cleared token via the settings store (bypasses debounce)
  settingsStore.setSetData({
    discordToken: '',
    discordUsername: '',
    discordName: '',
    discordAvatarUrl: ''
  });

  // Also update the local reactive setData so the UI updates immediately
  setData.value = {
    ...setData.value,
    discordToken: '',
    discordUsername: '',
    discordName: '',
    discordAvatarUrl: ''
  };

  window.api.send('discord-logout');
  message.success('Logged out of Discord.');
};

const refreshDiscord = () => {
  // TODO: Implement IPC call to forcefully refresh presence
  console.log('Refresh Discord presence');
};

import { usePlayerCoreStore } from '@/store/modules/playerCore';

const playerCore = usePlayerCoreStore();

const activityTypeOptions = [
  { label: 'Playing', value: 'PLAYING' },
  { label: 'Streaming', value: 'STREAMING' },
  { label: 'Listening to', value: 'LISTENING' },
  { label: 'Watching', value: 'WATCHING' },
  { label: 'Competing', value: 'COMPETING' }
];

const activityTypeHeader = computed(() => {
  const currentType = setData.value.discordActivityType || 'LISTENING';
  const type = activityTypeOptions.find(opt => opt.value === currentType);
  return type ? type.label.toUpperCase() : 'LISTENING TO';
});

const previewSourceValue = (source: string) => {
  const currentSong = playerCore.currentSong;
  const artist = currentSong?.ar?.map((a: any) => a.name).join(' / ');
  const album = currentSong?.al?.name;
  
  if (!source) return null;

  switch (source) {
    case 'ARTIST': return artist || '';
    case 'ALBUM': return album || '';
    case 'SONG': return currentSong?.name || '';
    case 'APP': return 'Chorus Deck';
    default: return currentSong?.name || '';
  }
};

const getPlaceholderText = (source: string) => {
  switch (source) {
    case 'ARTIST': return 'Artist Name';
    case 'ALBUM': return 'Album Name';
    case 'SONG': return 'Song Title';
    case 'APP': return 'Chorus Deck';
    default: return 'Select Option';
  }
};

const previewName = computed(() => previewSourceValue(setData.value.discordActivityName));
const previewDetails = computed(() => previewSourceValue(setData.value.discordActivityDetails));
const previewState = computed(() => previewSourceValue(setData.value.discordActivityState));

const largeImagePreview = computed(() => {
  const type = setData.value.discordLargeImageType;
  const albumArt = playerCore.currentSong?.al?.picUrl;
  
  if (type === 'thumbnail' && albumArt) return albumArt;
  if (type === 'custom') return setData.value.discordLargeImageCustomUrl || 'https://raw.githubusercontent.com/slice-of-fun/Chorus-Music/main/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png';
  return 'https://raw.githubusercontent.com/slice-of-fun/Chorus-Music/main/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png';
});

const smallImagePreview = computed(() => {
  const type = setData.value.discordSmallImageType;
  const albumArt = playerCore.currentSong?.al?.picUrl;
  
  if (type === 'dontshow') return null;
  if (type === 'thumbnail' && albumArt) return albumArt;
  if (type === 'custom') return setData.value.discordSmallImageCustomUrl || 'https://raw.githubusercontent.com/slice-of-fun/Chorus-Music/main/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png';
  return 'https://raw.githubusercontent.com/slice-of-fun/Chorus-Music/main/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png';
});

const statusOptions = [
  { label: 'Online', value: 'online' },
  { label: 'Do Not Disturb', value: 'dnd' },
  { label: 'Idle', value: 'idle' },
  { label: 'Streaming', value: 'streaming' }
];

const platformOptions = [
  { label: 'Desktop', value: 'desktop' },
  { label: 'Xbox', value: 'xbox' },
  { label: 'Samsung', value: 'samsung' },
  { label: 'iOS', value: 'ios' },
  { label: 'Android', value: 'android' },
  { label: 'Embedded', value: 'embedded' },
  { label: 'PS4', value: 'ps4' },
  { label: 'PS5', value: 'ps5' }
];

// activityTypeOptions moved to top

const sourceOptions = [
  { label: 'Artist Name', value: 'ARTIST' },
  { label: 'Album Name', value: 'ALBUM' },
  { label: 'Song Title', value: 'SONG' },
  { label: 'App Name', value: 'APP' }
];

const imageTypeOptions = [
  { label: 'Album Artwork', value: 'thumbnail' },
  { label: 'Artist Artwork', value: 'artist' },
  { label: 'App Icon', value: 'appicon' },
  { label: 'Custom', value: 'custom' }
];

const smallImageTypeOptions = [
  { label: 'Don\'t Show', value: 'dontshow' },
  { label: 'Album Artwork', value: 'thumbnail' },
  { label: 'Artist Artwork', value: 'artist' },
  { label: 'App Icon', value: 'appicon' },
  { label: 'Custom', value: 'custom' }
];

const urlSourceOptions = [
  { label: 'Song URL', value: 'songurl' },
  { label: 'Artist URL', value: 'artisturl' },
  { label: 'Album URL', value: 'albumurl' },
  { label: 'Custom URL', value: 'custom' }
];
</script>
