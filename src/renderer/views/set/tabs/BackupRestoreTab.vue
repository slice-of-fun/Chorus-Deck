<template>
  <div>
    <setting-section title="Backup & Restore">
      <setting-item
        icon="ri-save-line"
        title="Local Backup"
        description="Create a manual zip backup of your data"
      >
        <template #action>
          <n-button secondary round>
            <template #icon><i class="ri-save-line"></i></template>
            Backup
          </n-button>
        </template>
      </setting-item>

      <setting-item
        icon="ri-spotify-line"
        title="Import from Spotify"
        description="Import playlists and liked songs from Spotify"
      >
        <template #action>
          <n-button secondary round>
            <template #icon><i class="ri-spotify-line"></i></template>
            Import
          </n-button>
        </template>
      </setting-item>
    </setting-section>

    <setting-section title="Import Data">
      <setting-item
        icon="ri-folder-open-line"
        title="Import from local file"
        description="Restore data from backups or other sources"
      >
        <template #action>
          <n-button secondary round>
            <template #icon><i class="ri-folder-open-line"></i></template>
            Import
          </n-button>
        </template>
      </setting-item>

      <setting-item
        icon="ri-play-list-add-line"
        title="Import 'm3u' Playlist"
        description="Import m3u format playlist"
      >
        <template #action>
          <n-button secondary round>
            <template #icon><i class="ri-play-list-add-line"></i></template>
            Import
          </n-button>
        </template>
      </setting-item>

      <setting-item
        icon="ri-file-list-line"
        title="Import 'csv' Playlist"
        description="Import csv format playlist"
      >
        <template #action>
          <n-button secondary round>
            <template #icon><i class="ri-play-list-add-line"></i></template>
            Import
          </n-button>
        </template>
      </setting-item>
    </setting-section>
  </div>
</template>

<script setup lang="ts">
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
</script>
