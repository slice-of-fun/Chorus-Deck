<template>
  <div>
    <!-- Account -->
    <setting-section title="Account">
      <!-- Outer Card -->
      <div
        class="flex flex-col p-5 rounded-3xl bg-black/5 dark:bg-[#1a1b1e] mb-4 space-y-4 shadow-sm"
      >
        <!-- User Info Row -->
        <div class="flex items-center space-x-4">
          <!-- Avatar with Glow -->
          <div class="relative">
            <div
              class="absolute inset-0 rounded-full shadow-[0_0_30px_rgba(88,101,242,0.56)] bg-[#5865F2]"
              v-if="setData.discordToken"
            ></div>
            <div
              class="relative w-[88px] h-[88px] rounded-full bg-black/10 dark:bg-[#2b2d31] flex items-center justify-center overflow-hidden z-10 border-[4px] border-[#1a1b1e] dark:border-[#2b2d31]"
            >
              <img
                v-if="setData.discordToken && setData.discordAvatarUrl"
                :src="setData.discordAvatarUrl"
                alt="Avatar"
                class="w-full h-full object-cover"
              />
              <n-icon v-else size="40" class="text-black/50 dark:text-white/50">
                <svg viewBox="0 0 50 50" fill="currentColor">
                  <path
                    d="M 41.625 10.769531 C 37.644531 7.566406 31.347656 7.023438 31.078125 7.003906 C 30.660156 6.96875 30.261719 7.203125 30.089844 7.589844 C 30.074219 7.613281 29.9375 7.929688 29.785156 8.421875 C 32.417969 8.867188 35.652344 9.761719 38.578125 11.578125 C 39.046875 11.867188 39.191406 12.484375 38.902344 12.953125 C 38.710938 13.261719 38.386719 13.429688 38.050781 13.429688 C 37.871094 13.429688 37.6875 13.378906 37.523438 13.277344 C 32.492188 10.15625 26.210938 10 25 10 C 23.789063 10 17.503906 10.15625 12.476563 13.277344 C 12.007813 13.570313 11.390625 13.425781 11.101563 12.957031 C 10.808594 12.484375 10.953125 11.871094 11.421875 11.578125 C 14.347656 9.765625 17.582031 8.867188 20.214844 8.425781 C 20.0625 7.929688 19.925781 7.617188 19.914063 7.589844 C 19.738281 7.203125 19.34375 6.960938 18.921875 7.003906 C 18.652344 7.023438 12.355469 7.566406 8.320313 10.8125 C 6.214844 12.761719 2 24.152344 2 34 C 2 34.175781 2.046875 34.34375 2.132813 34.496094 C 5.039063 39.605469 12.972656 40.941406 14.78125 41 C 14.789063 41 14.800781 41 14.8125 41 C 15.132813 41 15.433594 40.847656 15.621094 40.589844 L 17.449219 38.074219 C 12.515625 36.800781 9.996094 34.636719 9.851563 34.507813 C 9.4375 34.144531 9.398438 33.511719 9.765625 33.097656 C 10.128906 32.683594 10.761719 32.644531 11.175781 33.007813 C 11.234375 33.0625 15.875 37 25 37 C 34.140625 37 38.78125 33.046875 38.828125 33.007813 C 39.242188 32.648438 39.871094 32.683594 40.238281 33.101563 C 40.601563 33.515625 40.5625 34.144531 40.148438 34.507813 C 40.003906 34.636719 37.484375 36.800781 32.550781 38.074219 L 34.378906 40.589844 C 34.566406 40.847656 34.867188 41 35.1875 41 C 35.199219 41 35.210938 41 35.21875 41 C 37.027344 40.941406 44.960938 39.605469 47.867188 34.496094 C 47.953125 34.34375 48 34.175781 48 34 C 48 24.152344 43.785156 12.761719 41.625 10.769531 Z M 18.5 30 C 16.566406 30 15 28.210938 15 26 C 15 23.789063 16.566406 22 18.5 22 C 20.433594 22 22 23.789063 22 26 C 22 28.210938 20.433594 30 18.5 30 Z M 31.5 30 C 29.566406 30 28 28.210938 28 26 C 28 23.789063 29.566406 22 31.5 22 C 33.433594 22 35 23.789063 35 26 C 35 28.210938 33.433594 30 31.5 30 Z"
                  />
                </svg>
              </n-icon>
            </div>
          </div>

          <div class="flex flex-col">
            <span class="text-[22px] font-bold">{{
              setData.discordName || setData.discordUsername || 'Account'
            }}</span>
            <span v-if="setData.discordUsername" class="text-base text-primary font-medium"
              >@{{ setData.discordUsername }}</span
            >
          </div>
        </div>

        <!-- Session Status -->
        <div
          class="rounded-2xl p-3.5 px-4 flex items-center space-x-3 transition-colors"
          :class="
            setData.discordToken ? 'bg-primary/20 text-primary' : 'bg-black/5 dark:bg-white/10'
          "
        >
          <n-icon
            size="20"
            :class="setData.discordToken ? 'text-primary' : 'text-black/60 dark:text-white/60'"
          >
            <svg
              v-if="setData.discordToken"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <svg v-else viewBox="0 0 50 50" fill="currentColor">
              <path
                d="M 41.625 10.769531 C 37.644531 7.566406 31.347656 7.023438 31.078125 7.003906 C 30.660156 6.96875 30.261719 7.203125 30.089844 7.589844 C 30.074219 7.613281 29.9375 7.929688 29.785156 8.421875 C 32.417969 8.867188 35.652344 9.761719 38.578125 11.578125 C 39.046875 11.867188 39.191406 12.484375 38.902344 12.953125 C 38.710938 13.261719 38.386719 13.429688 38.050781 13.429688 C 37.871094 13.429688 37.6875 13.378906 37.523438 13.277344 C 32.492188 10.15625 26.210938 10 25 10 C 23.789063 10 17.503906 10.15625 12.476563 13.277344 C 12.007813 13.570313 11.390625 13.425781 11.101563 12.957031 C 10.808594 12.484375 10.953125 11.871094 11.421875 11.578125 C 14.347656 9.765625 17.582031 8.867188 20.214844 8.425781 C 20.0625 7.929688 19.925781 7.617188 19.914063 7.589844 C 19.738281 7.203125 19.34375 6.960938 18.921875 7.003906 C 18.652344 7.023438 12.355469 7.566406 8.320313 10.8125 C 6.214844 12.761719 2 24.152344 2 34 C 2 34.175781 2.046875 34.34375 2.132813 34.496094 C 5.039063 39.605469 12.972656 40.941406 14.78125 41 C 14.789063 41 14.800781 41 14.8125 41 C 15.132813 41 15.433594 40.847656 15.621094 40.589844 L 17.449219 38.074219 C 12.515625 36.800781 9.996094 34.636719 9.851563 34.507813 C 9.4375 34.144531 9.398438 33.511719 9.765625 33.097656 C 10.128906 32.683594 10.761719 32.644531 11.175781 33.007813 C 11.234375 33.0625 15.875 37 25 37 C 34.140625 37 38.78125 33.046875 38.828125 33.007813 C 39.242188 32.648438 39.871094 32.683594 40.238281 33.101563 C 40.601563 33.515625 40.5625 34.144531 40.148438 34.507813 C 40.003906 34.636719 37.484375 36.800781 32.550781 38.074219 L 34.378906 40.589844 C 34.566406 40.847656 34.867188 41 35.1875 41 C 35.199219 41 35.210938 41 35.21875 41 C 37.027344 40.941406 44.960938 39.605469 47.867188 34.496094 C 47.953125 34.34375 48 34.175781 48 34 C 48 24.152344 43.785156 12.761719 41.625 10.769531 Z M 18.5 30 C 16.566406 30 15 28.210938 15 26 C 15 23.789063 16.566406 22 18.5 22 C 20.433594 22 22 23.789063 22 26 C 22 28.210938 20.433594 30 18.5 30 Z M 31.5 30 C 29.566406 30 28 28.210938 28 26 C 28 23.789063 29.566406 22 31.5 22 C 33.433594 22 35 23.789063 35 26 C 35 28.210938 33.433594 30 31.5 30 Z"
              />
            </svg>
          </n-icon>
          <span class="text-[15px] font-medium">{{
            setData.discordToken
              ? 'Discord account ready'
              : "Connect to Discord to show what you're listening to"
          }}</span>
        </div>

        <!-- Gateway Session Status -->
        <div
          v-if="setData.discordToken && setData.discordRPCEnabled"
          class="rounded-2xl p-3.5 px-4 flex items-center space-x-3 transition-colors min-w-0"
          :class="
            gatewayStatus?.connected
              ? 'bg-green-500/15 text-green-600 dark:text-green-400'
              : 'bg-black/5 dark:bg-white/10'
          "
        >
          <n-icon
            size="20"
            :class="
              gatewayStatus?.connected
                ? 'text-green-600 dark:text-green-400'
                : 'text-black/60 dark:text-white/60'
            "
          >
            <svg
              v-if="gatewayStatus?.connected"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
              <line x1="12" y1="12" x2="12" y2="16"></line>
            </svg>
          </n-icon>
          <span class="text-[15px] font-medium truncate" :title="gatewayStatusLabel">{{
            gatewayStatusLabel
          }}</span>
        </div>

        <!-- Enable RPC Toggle inside Account Card -->
        <div
          :class="[
            'w-full rounded-2xl p-4 flex items-center justify-between transition-colors',
            setData.discordRPCEnabled && setData.discordToken
              ? 'bg-primary/20'
              : 'bg-black/5 dark:bg-white/10'
          ]"
        >
          <div class="flex items-center space-x-4">
            <div class="w-11 h-11 rounded-lg bg-background flex items-center justify-center">
              <n-icon size="24" class="text-primary">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
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
            :loading="loggingIn"
            class="h-[60px] text-[16px] font-bold rounded-[8px] bg-[#5865F2] hover:bg-[#4752C4] text-white border-none shadow-[0_8px_16px_rgba(88,101,242,0.24)] transition-all hover:shadow-[0_12px_20px_rgba(88,101,242,0.32)] hover:-translate-y-0.5"
            @click="loginDiscordWebView"
          >
            <template #icon>
              <n-icon size="24"
                ><svg viewBox="0 0 50 50" fill="currentColor">
                  <path
                    d="M 41.625 10.769531 C 37.644531 7.566406 31.347656 7.023438 31.078125 7.003906 C 30.660156 6.96875 30.261719 7.203125 30.089844 7.589844 C 30.074219 7.613281 29.9375 7.929688 29.785156 8.421875 C 32.417969 8.867188 35.652344 9.761719 38.578125 11.578125 C 39.046875 11.867188 39.191406 12.484375 38.902344 12.953125 C 38.710938 13.261719 38.386719 13.429688 38.050781 13.429688 C 37.871094 13.429688 37.6875 13.378906 37.523438 13.277344 C 32.492188 10.15625 26.210938 10 25 10 C 23.789063 10 17.503906 10.15625 12.476563 13.277344 C 12.007813 13.570313 11.390625 13.425781 11.101563 12.957031 C 10.808594 12.484375 10.953125 11.871094 11.421875 11.578125 C 14.347656 9.765625 17.582031 8.867188 20.214844 8.425781 C 20.0625 7.929688 19.925781 7.617188 19.914063 7.589844 C 19.738281 7.203125 19.34375 6.960938 18.921875 7.003906 C 18.652344 7.023438 12.355469 7.566406 8.320313 10.8125 C 6.214844 12.761719 2 24.152344 2 34 C 2 34.175781 2.046875 34.34375 2.132813 34.496094 C 5.039063 39.605469 12.972656 40.941406 14.78125 41 C 14.789063 41 14.800781 41 14.8125 41 C 15.132813 41 15.433594 40.847656 15.621094 40.589844 L 17.449219 38.074219 C 12.515625 36.800781 9.996094 34.636719 9.851563 34.507813 C 9.4375 34.144531 9.398438 33.511719 9.765625 33.097656 C 10.128906 32.683594 10.761719 32.644531 11.175781 33.007813 C 11.234375 33.0625 15.875 37 25 37 C 34.140625 37 38.78125 33.046875 38.828125 33.007813 C 39.242188 32.648438 39.871094 32.683594 40.238281 33.101563 C 40.601563 33.515625 40.5625 34.144531 40.148438 34.507813 C 40.003906 34.636719 37.484375 36.800781 32.550781 38.074219 L 34.378906 40.589844 C 34.566406 40.847656 34.867188 41 35.1875 41 C 35.199219 41 35.210938 41 35.21875 41 C 37.027344 40.941406 44.960938 39.605469 47.867188 34.496094 C 47.953125 34.34375 48 34.175781 48 34 C 48 24.152344 43.785156 12.761719 41.625 10.769531 Z M 18.5 30 C 16.566406 30 15 28.210938 15 26 C 15 23.789063 16.566406 22 18.5 22 C 20.433594 22 22 23.789063 22 26 C 22 28.210938 20.433594 30 18.5 30 Z M 31.5 30 C 29.566406 30 28 28.210938 28 26 C 28 23.789063 29.566406 22 31.5 22 C 33.433594 22 35 23.789063 35 26 C 35 28.210938 33.433594 30 31.5 30 Z"
                  /></svg
              ></n-icon>
            </template>
            Connect to Discord
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
          Disconnect
        </n-button>
      </div>
    </setting-section>

    <!-- Options -->
    <setting-section title="Options">
      <setting-item title="Refresh" description="Force refresh Discord Rich Presence">
        <template #action>
          <n-button
            :disabled="!setData.discordRPCEnabled || !setData.discordToken"
            :loading="isRefreshing"
            @click="refreshDiscordClick"
          >
            Refresh
          </n-button>
        </template>
      </setting-item>
    </setting-section>

    <!-- Discord Connection Settings -->
    <setting-section
      title="Integration"
      :class="{ 'opacity-50 pointer-events-none': !setData.discordRPCEnabled }"
    >
      <list-dialog-preference
        title="Activity Status"
        description="Your online status on Discord"
        v-model:value="setData.discordPresenceStatus"
        :options="statusOptions"
      >
        <template #icon
          ><svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line></svg
        ></template>
      </list-dialog-preference>

      <list-dialog-preference
        title="Platform Status"
        description="The platform shown on Discord"
        v-model:value="setData.discordActivityPlatform"
        :options="platformOptions"
      >
        <template #icon
          ><svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line></svg
        ></template>
      </list-dialog-preference>
    </setting-section>

    <!-- Activity Content -->
    <setting-section
      title="Activity"
      :class="{ 'opacity-50 pointer-events-none': !setData.discordRPCEnabled }"
    >
      <list-dialog-preference
        title="Activity Name"
        description="The name of the activity"
        v-model:value="setData.discordActivityName"
        :options="sourceOptions"
      >
        <template #icon
          ><svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg
        ></template>
      </list-dialog-preference>

      <list-dialog-preference
        title="Activity Details"
        description="What to show on the first line"
        v-model:value="setData.discordActivityDetails"
        :options="sourceOptions"
      >
        <template #icon
          ><svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg
        ></template>
      </list-dialog-preference>

      <list-dialog-preference
        title="Status"
        description="What to show on the second line"
        v-model:value="setData.discordActivityState"
        :options="sourceOptions"
      >
        <template #icon
          ><svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg
        ></template>
      </list-dialog-preference>

      <setting-item
        title="Show When Paused"
        description="Keep Rich Presence active when playback is paused"
      >
        <template #icon
          ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 960" fill="currentColor">
            <path
              d="M520,760v-560h240v560L520,760ZM200,760v-560h240v560L200,760ZM600,680h80v-400h-80v400ZM280,680h80v-400h-80v400ZM280,280v400,-400ZM600,280v400,-400Z"
            /></svg
        ></template>

        <n-switch v-model:value="setData.discordShowWhenPaused" />
      </setting-item>

      <list-dialog-preference
        title="Activity Type"
        description="How the activity is displayed"
        v-model:value="setData.discordActivityType"
        :options="activityTypeOptions"
      >
        <template #icon
          ><svg viewBox="0 0 50 50" fill="currentColor">
            <path
              d="M 41.625 10.769531 C 37.644531 7.566406 31.347656 7.023438 31.078125 7.003906 C 30.660156 6.96875 30.261719 7.203125 30.089844 7.589844 C 30.074219 7.613281 29.9375 7.929688 29.785156 8.421875 C 32.417969 8.867188 35.652344 9.761719 38.578125 11.578125 C 39.046875 11.867188 39.191406 12.484375 38.902344 12.953125 C 38.710938 13.261719 38.386719 13.429688 38.050781 13.429688 C 37.871094 13.429688 37.6875 13.378906 37.523438 13.277344 C 32.492188 10.15625 26.210938 10 25 10 C 23.789063 10 17.503906 10.15625 12.476563 13.277344 C 12.007813 13.570313 11.390625 13.425781 11.101563 12.957031 C 10.808594 12.484375 10.953125 11.871094 11.421875 11.578125 C 14.347656 9.765625 17.582031 8.867188 20.214844 8.425781 C 20.0625 7.929688 19.925781 7.617188 19.914063 7.589844 C 19.738281 7.203125 19.34375 6.960938 18.921875 7.003906 C 18.652344 7.023438 12.355469 7.566406 8.320313 10.8125 C 6.214844 12.761719 2 24.152344 2 34 C 2 34.175781 2.046875 34.34375 2.132813 34.496094 C 5.039063 39.605469 12.972656 40.941406 14.78125 41 C 14.789063 41 14.800781 41 14.8125 41 C 15.132813 41 15.433594 40.847656 15.621094 40.589844 L 17.449219 38.074219 C 12.515625 36.800781 9.996094 34.636719 9.851563 34.507813 C 9.4375 34.144531 9.398438 33.511719 9.765625 33.097656 C 10.128906 32.683594 10.761719 32.644531 11.175781 33.007813 C 11.234375 33.0625 15.875 37 25 37 C 34.140625 37 38.78125 33.046875 38.828125 33.007813 C 39.242188 32.648438 39.871094 32.683594 40.238281 33.101563 C 40.601563 33.515625 40.5625 34.144531 40.148438 34.507813 C 40.003906 34.636719 37.484375 36.800781 32.550781 38.074219 L 34.378906 40.589844 C 34.566406 40.847656 34.867188 41 35.1875 41 C 35.199219 41 35.210938 41 35.21875 41 C 37.027344 40.941406 44.960938 39.605469 47.867188 34.496094 C 47.953125 34.34375 48 34.175781 48 34 C 48 24.152344 43.785156 12.761719 41.625 10.769531 Z M 18.5 30 C 16.566406 30 15 28.210938 15 26 C 15 23.789063 16.566406 22 18.5 22 C 20.433594 22 22 23.789063 22 26 C 22 28.210938 20.433594 30 18.5 30 Z M 31.5 30 C 29.566406 30 28 28.210938 28 26 C 28 23.789063 29.566406 22 31.5 22 C 33.433594 22 35 23.789063 35 26 C 35 28.210938 33.433594 30 31.5 30 Z"
            /></svg
        ></template>
      </list-dialog-preference>
      <list-dialog-preference
        title="Large Image"
      description="The main image displayed"
      v-model:value="setData.discordLargeImageType"
      :options="imageTypeOptions"
    >
      <template #icon
        ><svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline></svg
      ></template>
    </list-dialog-preference>
    <setting-item
      v-if="setData.discordLargeImageType === 'custom'"
      title="Large Image Custom URL"
      description="URL for the large image"
    >
      <template #icon
        ><svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg
      ></template>

      <template #action>
        <s-input
          v-model="setData.discordLargeImageCustomUrl"
          type="text"
          width="w-[200px]"
          placeholder="https://..."
        />
      </template>
    </setting-item>

    <list-dialog-preference
      title="Small Image"
      description="The secondary small image"
      v-model:value="setData.discordSmallImageType"
      :options="smallImageTypeOptions"
    >
      <template #icon
        ><svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline></svg
      ></template>
    </list-dialog-preference>

    <setting-item
      v-if="setData.discordSmallImageType === 'custom'"
      title="Small Image Custom URL"
      description="URL for the small image"
    >
      <template #icon
        ><svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg
      ></template>

      <template #action>
        <s-input
          v-model="setData.discordSmallImageCustomUrl"
          type="text"
          width="w-[200px]"
          placeholder="https://..."
        />
      </template>
    </setting-item>

    </setting-section>

    <!-- Preview -->
    <setting-section
      title="Preview"
      :class="{ 'opacity-50 pointer-events-none': !setData.discordRPCEnabled }"
    >
      <div class="w-full flex justify-center mt-4 mb-6">
        <div
          class="w-[420px] max-w-full bg-[#f2f3f5] dark:bg-[#2b2d31] rounded-[16px] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)] mx-auto"
        >
          <div
            class="w-full font-bold text-[12px] text-gray-600 dark:text-gray-400 text-left mb-4 uppercase tracking-wider"
          >
            {{ activityTypeHeader.toUpperCase() }}
          </div>

          <div class="flex items-start w-full">
            <div class="relative w-[112px] h-[112px] flex-shrink-0">
              <div
                class="absolute top-0 left-0 w-[100px] h-[100px] rounded-[16px] overflow-hidden flex items-center justify-center bg-black/5 dark:bg-white/5 shadow-md"
              >
                <img
                  v-if="largeImagePreview"
                  class="w-full h-full object-cover"
                  :src="largeImagePreview"
                  alt="Large Image"
                  @error="onLargeImageError"
                />
                <img
                  v-else
                  class="w-full h-full object-cover"
                  src="@/assets/logo.png"
                  alt="Blank Large Image"
                />
              </div>

              <div
                v-if="
                  setData.discordSmallImageType !== 'dontshow' &&
                  setData.discordSmallImageType !== 'none'
                "
                class="absolute top-[72px] left-[72px] rounded-full bg-[#f2f3f5] dark:bg-[#2b2d31] flex items-center justify-center z-10 p-1"
              >
                <div
                  class="w-[36px] h-[36px] rounded-full overflow-hidden flex items-center justify-center bg-black/5 dark:bg-white/5 shadow-sm"
                >
                  <img
                    v-if="smallImagePreview"
                    class="w-full h-full object-cover"
                    :src="smallImagePreview"
                    alt="Small Image"
                    @error="onSmallImageError"
                  />
                  <img
                    v-else
                    class="w-full h-full object-cover"
                    src="@/assets/logo.png"
                    alt="Blank Small Image"
                  />
                </div>
              </div>
            </div>

            <div class="flex flex-col flex-1 overflow-hidden min-w-0 px-2">
              <span class="font-bold text-black dark:text-white text-[15px] truncate leading-tight">
                {{ previewName || getPlaceholderText(setData.discordActivityName) }}
              </span>
              <span
                class="text-black dark:text-white text-[14px] truncate leading-tight mt-1"
                v-if="previewDetails || getPlaceholderText(setData.discordActivityDetails)"
              >
                {{ previewDetails || getPlaceholderText(setData.discordActivityDetails) }}
              </span>
              <span
                class="text-black dark:text-white text-[14px] truncate leading-tight"
                v-if="previewState || getPlaceholderText(setData.discordActivityState)"
              >
                {{ previewState || getPlaceholderText(setData.discordActivityState) }}
              </span>

              <div class="flex flex-col mt-3">
                <div
                  class="h-[6px] w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden"
                >
                  <div class="h-full bg-primary transition-all duration-1000 ease-linear" :style="{ width: `${previewProgress}%` }"></div>
                </div>
                <div
                  class="flex items-center justify-between text-[11px] font-medium text-black/50 dark:text-white/50 mt-1"
                >
                  <span>{{ formatTime(previewCurrentTime) }}</span>
                  <span>{{ formatTime(previewDuration) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Buttons -->
          <div class="w-full mt-4 flex flex-col space-y-2">
            <n-button
              v-if="setData.discordActivityButton1Enabled !== false"
              block
              secondary
              class="h-[40px] font-medium rounded-[4px] border-none bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {{ setData.discordActivityButton1Label || 'Listen on Chorus Deck' }}
            </n-button>
            <n-button
              v-if="setData.discordActivityButton2Enabled"
              block
              secondary
              class="h-[40px] font-medium rounded-[4px] border-none bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {{ setData.discordActivityButton2Label || 'Go to Chorus Deck' }}
            </n-button>
          </div>
        </div>
      </div>
    </setting-section>
  </div>
</template>

<script setup lang="ts">
import { NAvatar, NButton, NSelect, NSwitch } from 'naive-ui';
import { computed, inject } from 'vue';

import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import type { DiscordGatewayStatus } from '@/api/bridge';
import ListDialogPreference from '../ListDialogPreference.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SInput from '../SInput.vue';

const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

import { ref, onMounted, onUnmounted, watch } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';
import { ensureDiscordToken } from '@/utils/discordToken';

const settingsStore = useSettingsStore();
const tempDiscordToken = ref('');

const isRefreshing = ref(false);
const loggingIn = ref(false);
const gatewayStatus = ref<DiscordGatewayStatus | null>(null);

const gatewayStatusLabel = computed(() => {
  if (gatewayStatus.value?.connected) return 'Presence gateway connected';
  const err = gatewayStatus.value?.lastError;
  if (err && err !== 'connecting') return `Gateway issue: ${err}`;
  return 'Presence gateway idle';
});

let gatewayStatusInterval: any = null;

const pollGatewayStatus = async () => {
  try {
    gatewayStatus.value = await window.api.discordGatewayStatus();
  } catch {
    // ignore polling failures
  }
};

const refreshDiscordClick = async () => {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  try {
    await refreshDiscord(false);
  } finally {
    isRefreshing.value = false;
    void pollGatewayStatus();
  }
};

const previewCurrentTime = ref(0);
const previewDuration = ref(0);

const formatTime = (time: number) => {
  if (!time || isNaN(time)) return '0:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const previewProgress = computed(() => {
  if (!previewDuration.value) return 0;
  return Math.min(100, Math.max(0, (previewCurrentTime.value / previewDuration.value) * 100));
});

const largeImageError = ref(false);
const smallImageError = ref(false);

const onLargeImageError = (e: any) => {
  largeImageError.value = true;
};
const onSmallImageError = (e: any) => {
  smallImageError.value = true;
};

let previewInterval: any = null;

onMounted(() => {
  void pollGatewayStatus();
  gatewayStatusInterval = setInterval(pollGatewayStatus, 5000);

  previewInterval = setInterval(async () => {
    try {
      const time = await window.api.audioGetTime();
      const { audioService } = await import('@/services/audioService');
      const currentDur = audioService.getDuration();
      const songDur = playerCore.currentSong?.dt ? playerCore.currentSong.dt / 1000 : 0;
      
      previewCurrentTime.value = time;
      previewDuration.value = currentDur > 0 ? currentDur : (songDur > 0 ? songDur : 120);
    } catch (e) {
      // ignore
    }
  }, 1000);
});

let autoRefreshTimeout: any = null;

watch(
  () => [
    setData.value.discordRPCEnabled,
    setData.value.discordActivityName,
    setData.value.discordActivityDetails,
    setData.value.discordActivityState,
    setData.value.discordActivityType,
    setData.value.discordLargeImageType,
    setData.value.discordLargeImageCustomUrl,
    setData.value.discordSmallImageType,
    setData.value.discordSmallImageCustomUrl,
    setData.value.discordShowWhenPaused,
    setData.value.discordActivityButton1Enabled,
    setData.value.discordActivityButton1Label,
    setData.value.discordActivityButton1UrlSource,
    setData.value.discordActivityButton1CustomUrl,
    setData.value.discordActivityButton2Enabled,
    setData.value.discordActivityButton2Label,
    setData.value.discordActivityButton2UrlSource,
    setData.value.discordActivityButton2CustomUrl,
  ],
  () => {
    if (setData.value.discordRPCEnabled && setData.value.discordToken) {
      if (autoRefreshTimeout) clearTimeout(autoRefreshTimeout);
      autoRefreshTimeout = setTimeout(() => {
        refreshDiscord(true);
      }, 500);
    } else if (!setData.value.discordRPCEnabled && setData.value.discordToken) {
       window.api.clearDiscordPresence();
    }
  },
  { deep: true }
);

onUnmounted(() => {
  if (previewInterval) clearInterval(previewInterval);
  if (gatewayStatusInterval) clearInterval(gatewayStatusInterval);
});

const loginDiscordWebView = async () => {
  if (loggingIn.value) return;
  loggingIn.value = true;
  try {
    const userInfo = await window.api.invoke<{
      token: string;
      username?: string;
      name?: string;
      avatarUrl?: string;
      refreshToken?: string;
      expiresIn?: number;
    } | null>('discord-webview-login');
    if (userInfo && userInfo.token) {
      const expiresAt = userInfo.expiresIn
        ? Date.now() + userInfo.expiresIn * 1000
        : 0;
      // Persist immediately via the settings store (no debounce race)
      settingsStore.setSetData({
        discordToken: userInfo.token,
        discordUsername: userInfo.username || '',
        discordName: userInfo.name || userInfo.username || '',
        discordAvatarUrl: userInfo.avatarUrl || '',
        discordRefreshToken: userInfo.refreshToken || '',
        discordTokenExpiresAt: expiresAt,
        discordRPCEnabled: true
      });

      // Update local reactive setData so the UI reflects the change instantly
      setData.value = {
        ...setData.value,
        discordToken: userInfo.token,
        discordUsername: userInfo.username || '',
        discordName: userInfo.name || userInfo.username || '',
        discordAvatarUrl: userInfo.avatarUrl || '',
        discordRefreshToken: userInfo.refreshToken || '',
        discordTokenExpiresAt: expiresAt,
        discordRPCEnabled: true
      };

      message.success('Connected to Discord!');
    } else {
      message.warning('Could not retrieve Discord token. Connection cancelled.');
    }
  } catch (error: any) {
    const msg = typeof error === 'string' ? error : error?.message;
    if (msg === 'Window closed before login') {
      message.warning('Discord connection cancelled.');
    } else if (msg?.includes('already open')) {
      message.warning('A Discord login window is already open.');
    } else {
      console.error('Failed to login to Discord:', error);
      message.error('Discord login failed. Please try again.');
    }
  } finally {
    loggingIn.value = false;
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
    discordAvatarUrl: '',
    discordRPCEnabled: false
  };

  window.api.discordLogout();
  message.success('Logged out of Discord.');
};

const refreshDiscord = async (silent = false) => {
  const currentSong = playerCore.currentSong;
  if (!currentSong || !currentSong.name) {
    if (!silent) message.warning('No song is currently playing.');
    return;
  }

  try {
    const time = await window.api.audioGetTime();
    const { audioService } = await import('@/services/audioService');
    const currentTime = time * 1000;
    const currentDur = audioService.getDuration();
    const duration = currentDur > 0 ? currentDur * 1000 : currentSong.dt || 0;
    const isPlaying = playerCore.isPlaying;

    const s = setData.value;
    const songId = currentSong.id?.toString() || '';
    const artistId = currentSong.ar?.[0]?.id?.toString() || '';
    const albumId = currentSong.al?.id?.toString() || '';

    const songUrl = songId ? `https://music.youtube.com/watch?v=${songId}` : '';
    const artistUrl = artistId ? `https://music.youtube.com/channel/${artistId}` : '';
    const albumUrl = albumId ? `https://music.youtube.com/playlist?list=${albumId}` : '';

    const resolveButtonUrl = (source: string, custom: string): string => {
      switch ((source || 'songurl').toLowerCase()) {
        case 'songurl':
          return songUrl || 'https://github.com/slice-of-fun/Chorus-Deck';
        case 'artisturl':
          return artistUrl || songUrl || '';
        case 'albumurl':
          return albumUrl || songUrl || '';
        case 'custom':
          return custom || '';
        default:
          return '';
      }
    };

    const song = currentSong as any;
    await window.api.updateDiscordPresence({
      title: song.name,
      artist:
        song.ar?.map((a: any) => a.name).join(' / ') ||
        song.artists?.map((a: any) => a.name).join(' / ') ||
        'Unknown Artist',
      album:
        song.al?.name ||
        (typeof song.album === 'string' ? song.album : null) ||
        (typeof song.album === 'object' ? song.album?.name : null) ||
        'Unknown Album',
      albumArt: song.al?.picUrl || song.picUrl || '',
      songId,
      artistId,
      albumId,
      duration,
      isPlaying,
      startTimestamp: isPlaying ? Math.floor(Date.now() - currentTime) : undefined,
      activityName: s.discordActivityName || 'SONG',
      activityDetails: s.discordActivityDetails || 'ARTIST',
      activityState: s.discordActivityState || 'ALBUM',
      activityType: s.discordActivityType || 'LISTENING',
      largeImageType: s.discordLargeImageType || 'thumbnail',
      largeImageCustomUrl: s.discordLargeImageCustomUrl || '',
      smallImageType: s.discordSmallImageType || 'artist',
      smallImageCustomUrl: s.discordSmallImageCustomUrl || '',
      showWhenPaused: s.discordShowWhenPaused ?? false,
      button1Enabled: s.discordActivityButton1Enabled ?? true,
      button1Label: s.discordActivityButton1Label || 'Listen on Chorus Deck',
      button1Url: resolveButtonUrl(
        s.discordActivityButton1UrlSource || 'songurl',
        s.discordActivityButton1CustomUrl || ''
      ),
      button2Enabled: s.discordActivityButton2Enabled ?? false,
      button2Label: s.discordActivityButton2Label || 'Go to Chorus Deck',
      button2Url: resolveButtonUrl(
        s.discordActivityButton2UrlSource || 'custom',
        s.discordActivityButton2CustomUrl || 'https://github.com/slice-of-fun/Chorus-Deck'
      ),
      token: (await ensureDiscordToken(s)) || undefined
    });
    if (silent !== true) {
      message.success('Discord presence refreshed!');
    }
  } catch (e: any) {
    console.error('Failed to refresh Discord presence:', e);
    const detail = typeof e === 'string' ? e : e?.message || 'Unknown error';
    message.error(`Failed to refresh Discord presence: ${detail}`);
  }
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
  const type = activityTypeOptions.find((opt) => opt.value === currentType);
  return type ? type.label.toUpperCase() : 'LISTENING TO';
});

const previewSourceValue = (source: string) => {
  const currentSong = playerCore.currentSong;
  const isSongLoaded = !!(currentSong && currentSong.name);
  const artist =
    currentSong?.ar?.map((a: any) => a.name).join(' / ') ||
    (currentSong as any)?.artists?.map((a: any) => a.name).join(' / ') ||
    (isSongLoaded ? 'Unknown Artist' : '');
  // album can be: al.name (object), or album (string field)
  const album =
    currentSong?.al?.name ||
    (typeof (currentSong as any)?.album === 'string' ? (currentSong as any).album : null) ||
    (typeof (currentSong as any)?.album === 'object' ? (currentSong as any).album?.name : null) ||
    (isSongLoaded ? 'Unknown Album' : '');

  if (!source) return null;

  switch (source) {
    case 'ARTIST':
      return artist;
    case 'ALBUM':
      return album;
    case 'SONG':
      return currentSong?.name || '';
    case 'APP':
      return 'Chorus Deck';
    default:
      return currentSong?.name || '';
  }
};

const getPlaceholderText = (source: string) => {
  switch (source) {
    case 'ARTIST':
      return 'Artist Name';
    case 'ALBUM':
      return 'Album Name';
    case 'SONG':
      return 'Song Title';
    case 'APP':
      return 'Chorus Deck';
    default:
      return 'Select Option';
  }
};

const previewName = computed(() => previewSourceValue(setData.value.discordActivityName));
const previewDetails = computed(() => {
  const val = previewSourceValue(setData.value.discordActivityDetails);
  return val === previewName.value ? null : val;
});
const previewState = computed(() => {
  const val = previewSourceValue(setData.value.discordActivityState);
  return val === previewName.value || val === previewDetails.value ? null : val;
});
const previewLargeText = computed(() => {
  const val = previewSourceValue('ALBUM');
  return val === previewName.value || val === previewDetails.value || val === previewState.value
    ? null
    : val;
});

const largeImagePreview = computed(() => {
  if (largeImageError.value) return 'https://raw.githubusercontent.com/slice-of-fun/Chorus-Deck/main/resources/logo.png';
  
  const type = setData.value.discordLargeImageType;
  const song = playerCore.currentSong as any;
  if (!song || !song.name) return 'https://raw.githubusercontent.com/slice-of-fun/Chorus-Deck/main/resources/logo.png';

  const albumArt = song?.al?.picUrl || song?.picUrl || '';
  const artistPic = song?.ar?.[0]?.picUrl || song?.artists?.[0]?.picUrl || albumArt;

  if (type === 'thumbnail' && albumArt) return albumArt;
  if (type === 'artist' && artistPic) return artistPic;
  if (type === 'appicon')
    return '';
  if (type === 'custom')
    return (
      setData.value.discordLargeImageCustomUrl || ''
    );
  return albumArt || '';
});

const smallImagePreview = computed(() => {
  const type = setData.value.discordSmallImageType;
  if (type === 'dontshow') return null;
  if (smallImageError.value) return 'https://raw.githubusercontent.com/slice-of-fun/Chorus-Deck/main/resources/logo.png';

  const song = playerCore.currentSong as any;
  if (!song || !song.name) return 'https://raw.githubusercontent.com/slice-of-fun/Chorus-Deck/main/resources/logo.png';

  const albumArt = song?.al?.picUrl || song?.picUrl || '';
  const artistPic = song?.ar?.[0]?.picUrl || song?.artists?.[0]?.picUrl || albumArt;

  if (type === 'thumbnail' && albumArt) return albumArt;
  if (type === 'artist' && artistPic) return artistPic;
  if (type === 'appicon')
    return '';
  if (type === 'custom')
    return (
      setData.value.discordSmallImageCustomUrl || ''
    );
  return albumArt || '';
});

watch(largeImagePreview, () => {
  largeImageError.value = false;
});
watch(smallImagePreview, () => {
  smallImageError.value = false;
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
  { label: 'Chorus-Deck', value: 'APP' }
];

const imageTypeOptions = [
  { label: 'Album Artwork', value: 'thumbnail' },
  { label: 'Artist Artwork', value: 'artist' },
  { label: 'App Icon', value: 'appicon' },
  { label: 'Custom', value: 'custom' }
];

const smallImageTypeOptions = [
  { label: "Don't Show", value: 'dontshow' },
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
