<template>
  <div class="library-page h-full w-full bg-white dark:bg-black transition-colors duration-500">
    <n-scrollbar class="h-full">
      <div class="library-content pb-32">
        <section class="hero-section relative overflow-hidden rounded-tl-2xl">
          <div class="hero-bg absolute inset-0 -top-20">
            <div
              class="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 blur-3xl opacity-50 dark:opacity-30"
            ></div>
            <div
              class="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-black/80 dark:to-black"
            ></div>
          </div>

          <div class="hero-content relative z-10 page-padding-x pt-6 pb-4">
            <div class="flex items-center gap-5">
              <div
                class="cover-container relative w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-lg ring-2 ring-white/50 dark:ring-neutral-800/50 shrink-0"
              >
                <i class="ri-book-3-fill text-4xl text-primary opacity-80" />
              </div>

              <div class="info-content min-w-0">
                <h1
                  class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight"
                >
                  Your Library
                </h1>
                <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Manage your offline cache, downloads, and playlists
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="page-padding-x mt-6">
          <n-tabs type="line" animated justify-content="start" size="large">
            <!-- Playlists Section -->
            <n-tab-pane name="playlists" tab="Playlists">
              <div class="py-4 space-y-8">
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <button
                    class="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 hover:border-primary/50 transition-colors"
                    @click="handleAutoPlaylist('liked')"
                  >
                    <i class="ri-heart-3-fill text-2xl text-red-400"></i>
                    <span class="font-medium text-neutral-900 dark:text-white">Liked</span>
                  </button>
                  <button
                    class="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 hover:border-primary/50 transition-colors"
                    @click="handleAutoPlaylist('downloaded')"
                  >
                    <i class="ri-checkbox-circle-line text-2xl text-purple-500"></i>
                    <span class="font-medium text-neutral-900 dark:text-white">Downloaded</span>
                  </button>
                  <button
                    class="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 hover:border-primary/50 transition-colors"
                    @click="handleExport"
                  >
                    <i
                      class="ri-file-download-line text-2xl text-orange-700 dark:text-orange-300"
                    ></i>
                    <span class="font-medium text-neutral-900 dark:text-white">Export Data</span>
                  </button>
                  <button
                    class="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 hover:border-primary/50 transition-colors"
                    @click="showImportDialog = true"
                  >
                    <i class="ri-play-list-add-line text-2xl text-blue-500"></i>
                    <span class="font-medium text-neutral-900 dark:text-white">Import</span>
                  </button>
                  <button
                    class="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 hover:border-primary/50 transition-colors"
                    @click="handleAutoPlaylist('cached')"
                  >
                    <i class="ri-checkbox-circle-fill text-2xl text-purple-600"></i>
                    <span class="font-medium text-neutral-900 dark:text-white">Offline</span>
                  </button>
                  <button
                    class="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 hover:border-primary/50 transition-colors"
                    @click="handleAutoPlaylist('top')"
                  >
                    <i class="ri-line-chart-line text-2xl text-purple-500"></i>
                    <span class="font-medium text-neutral-900 dark:text-white">My top 50</span>
                  </button>
                  <button
                    class="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 hover:border-primary/50 transition-colors"
                    @click="handleAutoPlaylist('local')"
                  >
                    <i class="ri-folder-2-fill text-2xl text-teal-500"></i>
                    <span class="font-medium text-neutral-900 dark:text-white">Local</span>
                  </button>
                  <button
                    class="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 hover:border-primary/50 transition-colors"
                    @click="handleAutoPlaylist('followed')"
                  >
                    <i class="ri-user-follow-line text-2xl text-slate-500"></i>
                    <span class="font-medium text-neutral-900 dark:text-white"
                      >Followed Artists</span
                    >
                  </button>
                </div>

                <!-- User Playlists -->
                <div>
                  <div class="flex items-center justify-between gap-4 mb-4">
                    <h2 class="text-xl font-bold text-neutral-900 dark:text-white">Playlists</h2>
                    <n-button type="primary" size="small" @click="handleCreatePlaylist" circle>
                      <template #icon><i class="ri-add-line" /></template>
                    </n-button>
                  </div>

                  <div
                    v-if="playlists.length === 0"
                    class="empty-state py-12 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800"
                  >
                    <i
                      class="ri-play-list-2-fill text-5xl mb-4 text-neutral-300 dark:text-neutral-700"
                    />
                    <p class="text-neutral-500">
                      No playlists found. Create one or import from a URL.
                    </p>
                  </div>

                  <!-- Playlist Grid -->
                  <div
                    v-else
                    class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                  >
                    <div
                      v-for="playlist in playlists"
                      :key="playlist.id"
                      class="playlist-card group cursor-pointer p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 hover:border-primary/50 transition-colors"
                      @click="router.push({ name: 'playlistDetail', params: { id: playlist.id } })"
                    >
                      <div
                        class="aspect-square rounded-xl bg-neutral-200 dark:bg-neutral-800 mb-4 flex items-center justify-center"
                      >
                        <i
                          class="ri-play-list-2-fill text-4xl text-neutral-400 dark:text-neutral-600"
                        />
                      </div>
                      <h3 class="font-medium text-neutral-900 dark:text-white truncate">
                        {{ playlist.name }}
                      </h3>
                      <p class="text-xs text-neutral-500 truncate mt-1">
                        {{ playlist.description || 'No description' }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </n-tab-pane>

            <!-- Songs Section -->
            <n-tab-pane name="songs" tab="Songs">
              <div class="py-4 space-y-8">
                <div v-if="top50Tracks.length > 0">
                  <h2 class="text-xl font-bold mb-4 text-neutral-900 dark:text-white">
                    Top 50 Tracks
                  </h2>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div
                      v-for="(track, index) in top50Tracks"
                      :key="track.id || index"
                      class="p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl flex items-center gap-3"
                    >
                      <div
                        class="w-10 h-10 rounded bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center overflow-hidden shrink-0"
                      >
                        <img
                          v-if="track.thumbnail || track.artwork"
                          :src="track.thumbnail || track.artwork"
                          class="w-full h-full object-cover"
                        />
                        <i v-else class="ri-music-2-line text-neutral-400"></i>
                      </div>
                      <div class="min-w-0 flex-1">
                        <h4 class="font-medium text-neutral-900 dark:text-white truncate">
                          {{ track.title || track.name || 'Unknown Track' }}
                        </h4>
                        <p class="text-xs text-neutral-500 truncate">
                          {{ track.artist || track.artists || 'Unknown Artist' }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="downloadedTracks.length > 0">
                  <h2 class="text-xl font-bold mb-4 text-neutral-900 dark:text-white">
                    Downloaded Tracks
                  </h2>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div
                      v-for="(track, index) in downloadedTracks"
                      :key="track.id || index"
                      class="p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl flex items-center gap-3"
                    >
                      <div
                        class="w-10 h-10 rounded bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center overflow-hidden shrink-0"
                      >
                        <img
                          v-if="track.thumbnail || track.artwork"
                          :src="track.thumbnail || track.artwork"
                          class="w-full h-full object-cover"
                        />
                        <i v-else class="ri-music-2-line text-neutral-400"></i>
                      </div>
                      <div class="min-w-0 flex-1">
                        <h4 class="font-medium text-neutral-900 dark:text-white truncate">
                          {{ track.title || track.name || 'Unknown Track' }}
                        </h4>
                        <p class="text-xs text-neutral-500 truncate">
                          {{ track.artist || track.artists || 'Unknown Artist' }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-if="top50Tracks.length === 0 && downloadedTracks.length === 0"
                  class="py-12 text-center text-neutral-500"
                >
                  <i class="ri-music-2-line text-4xl mb-2"></i>
                  <p>No songs found yet</p>
                </div>
              </div>
            </n-tab-pane>

            <!-- Albums Section -->
            <n-tab-pane name="albums" tab="Albums">
              <div class="py-12 text-center text-neutral-500">
                <i class="ri-disc-line text-4xl mb-2"></i>
                <p>Albums view coming soon</p>
              </div>
            </n-tab-pane>

            <!-- Artists Section -->
            <n-tab-pane name="artists" tab="Artists">
              <div v-if="followedArtists.length === 0" class="py-12 text-center text-neutral-500">
                <i class="ri-mic-line text-4xl mb-2"></i>
                <p>No followed artists found</p>
              </div>
              <div v-else class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 py-4">
                <div
                  v-for="artist in followedArtists"
                  :key="artist.artist_id"
                  class="p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl text-center border border-neutral-100 dark:border-neutral-800 hover:border-primary/50 transition-colors"
                >
                  <div
                    class="w-24 h-24 mx-auto rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden mb-3 flex items-center justify-center"
                  >
                    <img
                      v-if="artist.artwork_url"
                      :src="artist.artwork_url"
                      class="w-full h-full object-cover"
                    />
                    <i v-else class="ri-user-3-fill text-4xl text-neutral-400"></i>
                  </div>
                  <h3 class="font-medium text-neutral-900 dark:text-white truncate">
                    {{ artist.artist_name }}
                  </h3>
                </div>
              </div>
            </n-tab-pane>

            <!-- Local Files Section -->
            <n-tab-pane name="local" tab="Local">
              <div class="py-4 space-y-6">
                <!-- Action Bar -->
                <div class="flex items-center justify-between gap-4">
                  <div class="flex-1 max-w-xs">
                    <n-input
                      v-model:value="searchKeyword"
                      placeholder="Search local music"
                      clearable
                      size="small"
                      round
                    >
                      <template #prefix>
                        <i class="ri-search-line text-neutral-400" />
                      </template>
                    </n-input>
                  </div>

                  <div class="flex items-center gap-3">
                    <button
                      v-if="filteredList.length > 0"
                      class="action-btn-pill flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all bg-primary text-white hover:bg-primary/90"
                      @click="handlePlayAll"
                    >
                      <i class="ri-play-fill text-lg" />
                      <span class="hidden md:inline">Play All</span>
                    </button>

                    <button
                      class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                      :disabled="localMusicStore.scanning"
                      @click="handleScan"
                    >
                      <i
                        class="ri-refresh-line text-lg"
                        :class="{ 'animate-spin': localMusicStore.scanning }"
                      />
                    </button>

                    <button
                      class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                      @click="handleAddFolder"
                    >
                      <i class="ri-folder-add-line text-lg" />
                    </button>

                    <button
                      v-if="localMusicStore.folderPaths.length > 0"
                      class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                      @click="showFolderManager = true"
                    >
                      <i class="ri-folder-settings-line text-lg" />
                    </button>
                  </div>
                </div>

                <!-- Scanning Status -->
                <div
                  v-if="localMusicStore.scanning"
                  class="flex items-center gap-4 p-4 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/20"
                >
                  <n-spin size="small" />
                  <div>
                    <p class="text-sm font-medium text-neutral-900 dark:text-white">Scanning...</p>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {{ t('localMusic.songCount', { count: localMusicStore.scanProgress }) }}
                    </p>
                  </div>
                </div>

                <!-- Empty State -->
                <div
                  v-if="!localMusicStore.scanning && filteredList.length === 0"
                  class="empty-state py-20 text-center bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800"
                >
                  <i
                    class="ri-folder-music-fill text-5xl mb-4 text-neutral-300 dark:text-neutral-700"
                  />
                  <p class="text-neutral-500">
                    No local music found. Please select a folder to scan.
                  </p>
                  <button
                    class="mt-6 px-6 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
                    @click="handleAddFolder"
                  >
                    <i class="ri-folder-add-line mr-2" />
                    Scan Folder
                  </button>
                </div>

                <!-- Song List -->
                <div v-else-if="filteredList.length > 0" class="song-list-container">
                  <song-item
                    v-for="(item, index) in filteredSongResults"
                    :key="item.id"
                    :index="index"
                    :item="item"
                    :can-remove="true"
                    @play="handlePlaySong"
                    @remove-song="handleRemoveSong"
                  />
                </div>
              </div>
            </n-tab-pane>
          </n-tabs>
        </section>
      </div>
    </n-scrollbar>

    <n-drawer v-model:show="showFolderManager" :width="400" placement="right">
      <n-drawer-content title="Manage Folders" closable>
        <div class="space-y-3 py-4">
          <div
            v-for="folder in localMusicStore.folderPaths"
            :key="folder"
            class="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <i class="ri-folder-line text-lg text-primary flex-shrink-0" />
              <span class="text-sm text-neutral-700 dark:text-neutral-300 truncate">{{
                folder
              }}</span>
            </div>
            <button
              class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0 ml-2"
              @click="handleRemoveFolder(folder)"
            >
              <i class="ri-delete-bin-line" />
            </button>
          </div>

          <div v-if="localMusicStore.folderPaths.length === 0" class="text-center py-8">
            <i class="ri-folder-line text-4xl text-neutral-200 dark:text-neutral-800" />
            <p class="text-sm text-neutral-400 mt-2">No local music folders found.</p>
          </div>
        </div>

        <template #footer>
          <n-button type="primary" block @click="handleAddFolder">
            <template #icon>
              <i class="ri-folder-add-line" />
            </template>
            Scan Folder
          </n-button>
        </template>
      </n-drawer-content>
    </n-drawer>

    <!-- Import Modal -->
    <n-modal v-model:show="showImportDialog">
      <n-card
        style="width: 500px"
        title="Import Playlists"
        :bordered="false"
        size="huge"
        role="dialog"
        aria-modal="true"
      >
        <div class="space-y-6">
          <div
            class="bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl p-6 border border-neutral-100 dark:border-neutral-800"
          >
            <h3 class="text-lg font-medium mb-2">Spotify Account</h3>
            <p class="text-neutral-500 text-sm mb-4">
              Login to Spotify to import all your liked songs and playlists.
            </p>
            <!-- Progress indicator when actively importing -->
            <div v-if="spotifyImportStatus" class="space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-neutral-600 dark:text-neutral-400 truncate max-w-[280px]">
                  Importing:
                  <span class="font-medium text-neutral-900 dark:text-white">{{
                    spotifyImportStatus.currentName
                  }}</span>
                </span>
                <span class="text-neutral-500 shrink-0 ml-2"
                  >{{ spotifyImportStatus.current }} / {{ spotifyImportStatus.total }}</span
                >
              </div>
              <div
                class="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden"
              >
                <div
                  class="h-full bg-green-500 rounded-full transition-all duration-300"
                  :style="{
                    width: `${(spotifyImportStatus.current / spotifyImportStatus.total) * 100}%`
                  }"
                />
              </div>
            </div>
            <n-button
              v-else
              type="primary"
              color="#1DB954"
              @click="handleSpotifyLogin"
              :loading="isSpotifyLoading"
            >
              <template #icon><i class="ri-spotify-fill" /></template>
              Login with Spotify
            </n-button>
          </div>

          <div
            class="bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl p-6 border border-neutral-100 dark:border-neutral-800"
          >
            <h3 class="text-lg font-medium mb-2">Import from URL</h3>
            <p class="text-neutral-500 text-sm mb-4">
              Paste a playlist URL from YouTube, Spotify, Apple Music, SoundCloud, or Amazon Music.
            </p>
            <div class="flex gap-4">
              <n-input v-model:value="importUrl" placeholder="https://..." clearable />
              <n-button type="primary" :loading="isImportingUrl" @click="handleUrlImport">
                Import
              </n-button>
            </div>
          </div>
        </div>
      </n-card>
    </n-modal>

    <n-modal v-model:show="showCreatePlaylistDialog">
      <n-card
        style="width: 400px"
        title="Create Playlist"
        :bordered="false"
        size="huge"
        role="dialog"
        aria-modal="true"
      >
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
              >Name</label
            >
            <n-input
              v-model:value="newPlaylistName"
              placeholder="My Awesome Playlist"
              @keyup.enter="confirmCreatePlaylist"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
              >Description (Optional)</label
            >
            <n-input
              v-model:value="newPlaylistDescription"
              type="textarea"
              placeholder="A collection of great songs..."
              :autosize="{ minRows: 2, maxRows: 5 }"
            />
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <n-button @click="showCreatePlaylistDialog = false">Cancel</n-button>
            <n-button type="primary" :loading="isCreatingPlaylist" @click="confirmCreatePlaylist"
              >Create</n-button
            >
          </div>
        </div>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import SongItem from '@/components/common/SongItem.vue';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import { selectDirectory } from '@/utils/fileOperation';
import { t } from '@/utils/i18n';
import { filterByKeyword, toSongResult } from '@/utils/localMusicUtils';

const { message } = createDiscreteApi(['message']);
const router = useRouter();
const localMusicStore = useLocalMusicStore();
const playerStore = usePlayerStore();

import { save } from '@tauri-apps/plugin-dialog';

const searchKeyword = ref('');
const showFolderManager = ref(false);
const showImportDialog = ref(false);

const filteredList = computed(() =>
  filterByKeyword(localMusicStore.musicList, searchKeyword.value)
);
const filteredSongResults = computed(() => filteredList.value.map(toSongResult));

function handleAutoPlaylist(type: string) {
  message.info(`Opening ${type} playlist...`);
  // Will be connected to router/playlist view
}

async function handleExport() {
  try {
    const exportPath = await save({
      title: 'Export User Data',
      defaultPath: 'chorus_deck_export.json',
      filters: [
        {
          name: 'JSON',
          extensions: ['json']
        }
      ]
    });
    if (exportPath) {
      await window.api.dbExportUserData(exportPath);
      message.success('Successfully exported user data to ' + exportPath);
    }
  } catch (err: any) {
    console.error('Export failed:', err);
    message.error('Failed to export: ' + err);
  }
}

async function handleAddFolder(): Promise<void> {
  try {
    const folderPath = await selectDirectory(message);
    if (folderPath) {
      localMusicStore.addFolder(folderPath);
      await localMusicStore.scanFolders();
    }
  } catch (error) {
    console.error('Failed to select folder:', error);
    message.error(String(error));
  }
}

async function handleRemoveFolder(folder: string): Promise<void> {
  await localMusicStore.removeFolder(folder);
}

async function handleScan(): Promise<void> {
  if (localMusicStore.folderPaths.length === 0) {
    await localMusicStore.scanFolders();
    await handleAddFolder();
    return;
  }
  await localMusicStore.scanFolders();
}

async function handlePlaySong(_song: SongResult): Promise<void> {
  try {
    playerStore.setQueue(filteredSongResults.value);
  } catch (error) {
    console.error('Failed to play local music:', error);
  }
}

async function handleRemoveSong(id: number | string): Promise<void> {
  try {
    await localMusicStore.removeEntry(String(id));
    message.success('Removed from library (file not deleted)');
  } catch (error) {
    console.error('Failed to remove local songs:', error);
    message.error(String(error));
  }
}

async function handlePlayAll(): Promise<void> {
  if (filteredSongResults.value.length === 0) return;

  try {
    const firstSong = filteredSongResults.value[0];
    const entry = filteredList.value[0];

    const exists = await window.api.checkFileExists(entry.filePath);
    if (!exists) {
      message.error('File not found or has been moved');
      return;
    }

    playerStore.setQueue(filteredSongResults.value);
    await playerStore.setPlay(firstSong);
  } catch (error) {
    console.error('Failed to play all:', error);
  }
}

const playlists = ref<any[]>([]);
const followedArtists = ref<any[]>([]);
const top50Tracks = ref<any[]>([]);
const downloadedTracks = ref<any[]>([]);

async function loadPlaylists() {
  try {
    playlists.value = await window.api.dbGetAllPlaylists();
  } catch (error) {
    console.error('Failed to load playlists:', error);
  }
}

async function loadLibraryData() {
  try {
    const [artists, top50, downloaded] = await Promise.all([
      window.api.dbGetFollowedArtists().catch(() => []),
      window.api.dbGetTop50Tracks().catch(() => []),
      window.api.dbGetDownloadedTracksFull().catch(() => [])
    ]);

    followedArtists.value = artists || [];
    top50Tracks.value = top50 || [];
    downloadedTracks.value = downloaded || [];
  } catch (error) {
    console.error('Failed to load library data:', error);
  }
}

function handleCreatePlaylist() {
  showCreatePlaylistDialog.value = true;
}

onMounted(async () => {
  if (!localMusicStore.scanning) {
    await localMusicStore.loadFromCache();
  }
  await loadPlaylists();
  await loadLibraryData();
});

const isSpotifyLoading = ref(false);
const spotifyImportStatus = ref<{ current: number; total: number; currentName: string } | null>(
  null
);

async function handleSpotifyLogin() {
  if (isSpotifyLoading.value) return;
  isSpotifyLoading.value = true;
  spotifyImportStatus.value = null;
  message.info('Opening Spotify login...');

  try {
    // NOTE: In production, read clientId/clientSecret from secure store or settings.
    // Hardcoded placeholders must be replaced before shipping.
    const clientId =
      ((await window.api.getStoreValue('spotify-client-id').catch(() => null)) as string | null) ??
      'YOUR_SPOTIFY_CLIENT_ID';
    const clientSecret =
      ((await window.api.getStoreValue('spotify-client-secret').catch(() => null)) as
        string | null) ?? 'YOUR_SPOTIFY_CLIENT_SECRET';

    // Step 1: Browser OAuth — blocks until callback is received on localhost:8888
    const code = await window.api.spotifyLogin(clientId);
    if (!code) throw new Error('Failed to obtain authorization code.');

    message.info('Authorization code received, exchanging for token...');

    // Step 2: Exchange code for access + refresh tokens
    const tokenResponse = await window.api.spotifyExchangeToken(code, clientId, clientSecret);
    window.api.setStoreValue('spotify-token', tokenResponse);

    const accessToken: string = tokenResponse.access_token;
    message.success('Logged in! Fetching your Spotify library...');

    // Step 3: Fetch all playlists
    const playlistsResponse = await window.api.spotifyFetchPlaylists(accessToken);
    const playlists: any[] = playlistsResponse?.items ?? [];

    if (playlists.length === 0) {
      message.warning('No Spotify playlists found.');
      return;
    }

    spotifyImportStatus.value = { current: 0, total: playlists.length, currentName: '' };

    // Step 4: Import each playlist and all its tracks
    let importedCount = 0;
    for (const [idx, pl] of playlists.entries()) {
      spotifyImportStatus.value = {
        current: idx + 1,
        total: playlists.length,
        currentName: pl.name
      };

      const tracks: { id: string; title: string; artist: string; durationMs: number }[] = [];
      let offset = 0;
      const limit = 100;

      // Paginate through all tracks in this playlist
      while (true) {
        const page = await window.api.spotifyFetchPlaylistTracks(accessToken, pl.id, offset, limit);
        const items: any[] = page?.items ?? [];

        for (const item of items) {
          const t = item?.track;
          if (!t || t.is_local) continue;
          const artistNames: string = (t.artists ?? []).map((a: any) => a.name).join(', ');
          tracks.push({
            id: `spotify:${t.id}`,
            title: t.name ?? 'Unknown Track',
            artist: artistNames || 'Unknown Artist',
            durationMs: t.duration_ms ?? 0
          });
        }

        if (items.length < limit) break;
        offset += limit;
      }

      if (tracks.length > 0) {
        await window.api.dbImportPlaylist(
          `spotify:${pl.id}`,
          pl.name,
          pl.description ?? `Imported from Spotify`,
          tracks
        );
        importedCount++;
      }
    }

    message.success(`Successfully imported ${importedCount} Spotify playlist(s)!`);
    showImportDialog.value = false;
    await loadPlaylists();
  } catch (error: any) {
    console.error('Spotify login error:', error);
    message.error(`Spotify import failed: ${String(error)}`);
  } finally {
    isSpotifyLoading.value = false;
    spotifyImportStatus.value = null;
  }
}

const importUrl = ref('');
const isImportingUrl = ref(false);

async function handleUrlImport() {
  if (!importUrl.value.trim()) {
    message.warning('Please enter a valid URL.');
    return;
  }

  if (isImportingUrl.value) return;
  isImportingUrl.value = true;

  try {
    message.info('Parsing URL...');
    const result = await window.api.parsePlaylistUrl(importUrl.value.trim());

    if (!result?.playlist) {
      throw new Error('Unexpected response from parser');
    }

    const { title, tracks } = result.playlist as {
      title: string;
      tracks: { title: string; artist: string; durationMs?: number }[];
    };

    if (!tracks || tracks.length === 0) {
      message.warning(`Parsed playlist "${title}" has no tracks. Nothing was imported.`);
      return;
    }

    // Normalise tracks into the ImportedTrack shape expected by the Rust command.
    const importedTracks = tracks.map((t, i) => ({
      id: `${result.provider.toLowerCase()}:imported:${Date.now()}:${i}`,
      title: t.title || 'Unknown Track',
      artist: t.artist || 'Unknown Artist',
      durationMs: t.durationMs ?? 0
    }));

    const playlistId = `imported:${result.provider.toLowerCase()}:${Date.now()}`;
    await window.api.dbImportPlaylist(
      playlistId,
      title,
      `Imported from ${result.provider}`,
      importedTracks
    );

    message.success(`Imported "${title}" — ${importedTracks.length} tracks saved!`);
    importUrl.value = '';
    showImportDialog.value = false;
    await loadPlaylists();
  } catch (error: any) {
    console.error('Import error:', error);
    message.error(`Import failed: ${String(error)}`);
  } finally {
    isImportingUrl.value = false;
  }
}

function handleImport(_provider: string) {
  // Directs the user to the URL import field — provider-specific flows
  // (e.g. Spotify OAuth) are handled by their dedicated buttons.
  showImportDialog.value = true;
}

const showCreatePlaylistDialog = ref(false);
const newPlaylistName = ref('');
const newPlaylistDescription = ref('');
const isCreatingPlaylist = ref(false);

async function confirmCreatePlaylist() {
  if (!newPlaylistName.value.trim()) {
    message.warning('Please enter a playlist name.');
    return;
  }

  if (isCreatingPlaylist.value) return;
  isCreatingPlaylist.value = true;

  try {
    const id = Date.now().toString(); // Generate a simple ID
    await window.api.dbStorePlaylist(
      id,
      newPlaylistName.value.trim(),
      newPlaylistDescription.value.trim()
    );
    message.success('Playlist created successfully!');
    showCreatePlaylistDialog.value = false;
    newPlaylistName.value = '';
    newPlaylistDescription.value = '';
    await loadPlaylists();
    router.push({ name: 'playlistDetail', params: { id } });
  } catch (error: any) {
    console.error('Failed to create playlist:', error);
    message.error(`Failed to create playlist: ${error}`);
  } finally {
    isCreatingPlaylist.value = false;
  }
}
</script>

<style scoped>
.hero-section {
  min-height: 140px;
}
</style>
