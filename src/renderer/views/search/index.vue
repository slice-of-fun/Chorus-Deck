<template>
  <div class="search-page h-full w-full flex flex-col">
    <div
      class="search-header flex-shrink-0 w-full bg-[var(--shell-surface)] z-10"
      style="padding: var(--content-padding-y) var(--content-padding-x) 0 var(--content-padding-x)"
    >
      <div class="search-bar-wrapper relative mb-4">
        <div class="relative">
          <i
            class="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-lg pointer-events-none"
          />
          <input
            ref="searchInputRef"
            v-model="query"
            type="text"
            placeholder="Search songs, artists, albums, playlists…"
            class="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 border-transparent text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-0 focus:border-transparent text-sm font-medium transition-all duration-200"
            @keyup.enter="() => doSearch(true)"
            @keyup.escape="clearQuery"
            @input="onQueryInput"
          />
          <button
            v-if="query"
            class="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            @click="clearQuery"
          >
            <i class="ri-close-line text-lg" />
          </button>
        </div>

        <div
          v-if="suggestions.length > 0 && query && !searchDone"
          class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 overflow-hidden"
        >
          <button
            v-for="(s, i) in suggestions"
            :key="i"
            class="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
            @click="selectSuggestion(s)"
          >
            <i class="text-base text-neutral-400 ri-search-line" />
            <span class="text-sm text-neutral-700 dark:text-neutral-300 flex-1">{{ s }}</span>
            <i
              class="ri-arrow-up-left-line text-neutral-300 dark:text-neutral-600 text-xs"
              title="Fill search bar"
            />
          </button>
        </div>
      </div>
    </div>

    <n-scrollbar class="flex-1">
      <div class="search-content w-full pb-32">
        <!-- ── Search results ─────────────────────────────────────── -->
        <div v-if="searchDone">
          <!-- Result tabs -->
          <div
            class="flex items-center gap-1 mb-6 overflow-x-auto pb-1 no-scrollbar px-[var(--content-padding-x)]"
          >
            <button
              v-for="tab in SEARCH_TABS"
              :key="tab.key"
              class="flex-shrink-0 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200"
              :class="
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
              "
              @click="switchTab(tab.key)"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- Loading results -->
          <div v-if="searchLoading" class="space-y-1 px-[var(--content-padding-x)]">
            <div v-for="i in 8" :key="i" class="flex items-center gap-4 px-3 py-2.5 rounded-xl">
              <div
                :class="[
                  'w-12 h-12 skeleton-shimmer flex-shrink-0',
                  activeTab === 'artists' ? 'rounded-full' : 'rounded-lg'
                ]"
              />
              <div class="flex-1 space-y-2 min-w-0 py-1">
                <div class="h-4 w-2/3 skeleton-shimmer rounded" />
                <div class="h-3 w-1/3 skeleton-shimmer rounded" />
              </div>
            </div>
          </div>
          <div v-else-if="activeTab === 'all'" class="space-y-8 px-[var(--content-padding-x)]">
            <div
              v-if="
                results.songs.length === 0 &&
                !results.playlists?.length &&
                !results.albums?.length &&
                !results.artists?.length &&
                !results.videos?.length
              "
              class="text-center py-12 text-neutral-400"
            >
              <i class="ri-search-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No results found for "{{ lastQuery }}"</p>
            </div>

            <section v-if="results.topResult" class="mb-8">
              <h2 class="text-xl font-bold text-neutral-900 dark:text-white mb-3 px-1">
                Top Result
              </h2>
              <div
                class="group flex items-center gap-4 bg-neutral-100/80 dark:bg-neutral-900/50 p-4 rounded-3xl cursor-pointer hover:bg-neutral-200/80 dark:hover:bg-neutral-800/50 transition-all"
                @click="onTopResultClick"
              >
                <div
                  :class="[
                    'relative w-24 h-24 flex-shrink-0 overflow-hidden bg-neutral-200 dark:bg-neutral-800',
                    'artists' in results.topResult
                      ? 'rounded-lg'
                      : (results.topResult as any).type === 'artist'
                        ? 'rounded-full'
                        : 'rounded-lg'
                  ]"
                >
                  <i
                    class="ri-image-line absolute inset-0 flex items-center justify-center text-neutral-400 text-2xl"
                  ></i>
                  <img
                    :src="results.topResult.picUrl"
                    :alt="results.topResult.name"
                    @error="$event.target.style.opacity=0"
                    class="relative z-10 w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div
                    v-if="'artists' in results.topResult"
                    class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <i class="ri-play-fill text-white text-3xl" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-2xl font-bold text-neutral-900 dark:text-white line-clamp-1 mb-1">
                    {{ results.topResult.name }}
                  </p>
                  <p class="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-1">
                    <span v-if="'artists' in results.topResult">
                      Song •
                      {{ (results.topResult as any).artists?.map((a: any) => a.name).join(', ') }}
                    </span>
                    <span v-else>
                      {{
                        (results.topResult as any).type?.charAt(0).toUpperCase() +
                        (results.topResult as any).type?.slice(1)
                      }}
                      <template v-if="(results.topResult as any).desc"
                        >• {{ (results.topResult as any).desc }}</template
                      >
                    </span>
                  </p>
                </div>
              </div>
            </section>

            <section v-if="results.songs.length > 0" class="mb-8">
              <h2 class="text-xl font-bold text-neutral-900 dark:text-white mb-3 px-1">Songs</h2>
              <div
                class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
              >
                <div
                  v-for="(song, idx) in results.songs"
                  :key="song.id"
                  class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                  :style="{ animationDelay: idx * 0.02 + 's' }"
                  @click="playSong(song)"
                >
                  <div
                    class="relative w-11 h-11 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                  >
                    <i
                      class="ri-image-line absolute inset-0 flex items-center justify-center text-neutral-400 text-2xl"
                    ></i>
                    <img
                      :src="song.picUrl"
                      :alt="song.name"
                      @error="\$event.target.style.opacity=0"
                      class="relative z-10 w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div
                      class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <i class="ri-play-fill text-white text-sm" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                    >
                      {{ song.name }}
                    </p>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                      {{ (song.artists || []).map((a) => a.name).join(', ') }}
                      <span v-if="song.album"> · {{ song.album }}</span>
                    </p>
                  </div>
                  <span
                    v-if="formatTime(song.dt)"
                    class="text-xs text-neutral-400 flex-shrink-0 tabular-nums"
                  >
                    {{ formatTime(song.dt) }}
                  </span>
                </div>
              </div>
            </section>

            <section v-if="results.artists && results.artists.length > 0" class="mb-8">
              <h2 class="text-xl font-bold text-neutral-900 dark:text-white mb-3 px-1">Artists</h2>
              <div
                class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
              >
                <div
                  v-for="(ar, idx) in results.artists"
                  :key="ar.id"
                  class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                  :style="{ animationDelay: idx * 0.02 + 's' }"
                  @click="goToArtist(ar.id)"
                >
                  <div
                    class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                  >
                    <i
                      class="ri-image-line absolute inset-0 flex items-center justify-center text-neutral-400 text-2xl"
                    ></i>
                    <img
                      :src="ar.picUrl"
                      :alt="ar.name"
                      @error="\$event.target.style.opacity=0"
                      class="relative z-10 w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                    >
                      {{ ar.name }}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section v-if="results.albums && results.albums.length > 0" class="mb-8">
              <h2 class="text-xl font-bold text-neutral-900 dark:text-white mb-3 px-1">Albums</h2>
              <div
                class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
              >
                <div
                  v-for="(al, idx) in results.albums"
                  :key="al.id"
                  class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                  :style="{ animationDelay: idx * 0.02 + 's' }"
                  @click="goToPlaylist(al.id)"
                >
                  <div
                    class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                  >
                    <i
                      class="ri-image-line absolute inset-0 flex items-center justify-center text-neutral-400 text-2xl"
                    ></i>
                    <img
                      :src="al.picUrl"
                      :alt="al.name"
                      @error="\$event.target.style.opacity=0"
                      class="relative z-10 w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                    >
                      {{ al.name }}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section v-if="results.playlists && results.playlists.length > 0" class="mb-8">
              <h2 class="text-xl font-bold text-neutral-900 dark:text-white mb-3 px-1">
                Playlists
              </h2>
              <div
                class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
              >
                <div
                  v-for="(pl, idx) in results.playlists"
                  :key="pl.id"
                  class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                  :style="{ animationDelay: idx * 0.02 + 's' }"
                  @click="goToPlaylist(pl.id)"
                >
                  <div
                    class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                  >
                    <i
                      class="ri-image-line absolute inset-0 flex items-center justify-center text-neutral-400 text-2xl"
                    ></i>
                    <img
                      :src="pl.picUrl"
                      :alt="pl.name"
                      @error="\$event.target.style.opacity=0"
                      class="relative z-10 w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p
                      class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                    >
                      {{ pl.name }}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- Songs -->
          <div v-else-if="activeTab === 'songs'" class="px-[var(--content-padding-x)]">
            <div v-if="results.songs.length === 0" class="text-center py-12 text-neutral-400">
              <i class="ri-music-2-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No songs found for "{{ lastQuery }}"</p>
            </div>
            <div
              v-else
              class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
            >
              <div
                v-for="(song, idx) in results.songs"
                :key="song.id"
                class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                :style="{ animationDelay: idx * 0.02 + 's' }"
                @click="playSong(song)"
              >
                <div
                  class="relative w-11 h-11 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                >
                  <i
                    class="ri-image-line absolute inset-0 flex items-center justify-center text-neutral-400 text-2xl"
                  ></i>
                  <img
                    :src="song.picUrl"
                    :alt="song.name"
                    @error="\$event.target.style.opacity=0"
                    class="relative z-10 w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div
                    class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <i class="ri-play-fill text-white text-sm" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ song.name }}
                  </p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                    {{ (song.artists || []).map((a) => a.name).join(', ') }}
                    <span v-if="song.album"> · {{ song.album }}</span>
                  </p>
                </div>
                <span
                  v-if="formatTime(song.dt)"
                  class="text-xs text-neutral-400 flex-shrink-0 tabular-nums"
                >
                  {{ formatTime(song.dt) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Playlists -->
          <div v-else-if="activeTab === 'playlists'" class="px-[var(--content-padding-x)]">
            <div v-if="results.playlists?.length === 0" class="text-center py-12 text-neutral-400">
              <i class="ri-play-list-2-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No playlists found for "{{ lastQuery }}"</p>
            </div>
            <div
              v-else
              class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
            >
              <div
                v-for="(pl, idx) in results.playlists"
                :key="pl.id"
                class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                :style="{ animationDelay: idx * 0.02 + 's' }"
                @click="goToPlaylist(pl.id)"
              >
                <div
                  class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                >
                  <i
                    class="ri-image-line absolute inset-0 flex items-center justify-center text-neutral-400 text-2xl"
                  ></i>
                  <img
                    :src="pl.picUrl"
                    :alt="pl.name"
                    @error="\$event.target.style.opacity=0"
                    class="relative z-10 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ pl.name }}
                  </p>
                  <p
                    v-if="pl.desc"
                    class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-0.5"
                  >
                    {{ pl.desc }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Albums -->
          <div v-else-if="activeTab === 'albums'" class="px-[var(--content-padding-x)]">
            <div v-if="results.albums?.length === 0" class="text-center py-12 text-neutral-400">
              <i class="ri-album-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No albums found for "{{ lastQuery }}"</p>
            </div>
            <div
              v-else
              class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
            >
              <div
                v-for="(al, idx) in results.albums"
                :key="al.id"
                class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                :style="{ animationDelay: idx * 0.02 + 's' }"
                @click="goToPlaylist(al.id)"
              >
                <div
                  class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                >
                  <i
                    class="ri-image-line absolute inset-0 flex items-center justify-center text-neutral-400 text-2xl"
                  ></i>
                  <img
                    :src="al.picUrl"
                    :alt="al.name"
                    @error="\$event.target.style.opacity=0"
                    class="relative z-10 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ al.name }}
                  </p>
                  <p
                    v-if="al.desc"
                    class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5"
                  >
                    {{ al.desc }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Artists -->
          <div v-else-if="activeTab === 'artists'" class="px-[var(--content-padding-x)]">
            <div v-if="results.artists?.length === 0" class="text-center py-12 text-neutral-400">
              <i class="ri-mic-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No artists found for "{{ lastQuery }}"</p>
            </div>
            <div
              v-else
              class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
            >
              <div
                v-for="(ar, idx) in results.artists"
                :key="ar.id"
                class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                :style="{ animationDelay: idx * 0.02 + 's' }"
                @click="goToArtist(ar.id)"
              >
                <div
                  class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                >
                  <i
                    class="ri-image-line absolute inset-0 flex items-center justify-center text-neutral-400 text-2xl"
                  ></i>
                  <img
                    :src="ar.picUrl"
                    :alt="ar.name"
                    @error="\$event.target.style.opacity=0"
                    class="relative z-10 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ ar.name }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Videos -->
          <div v-else-if="activeTab === 'videos'" class="px-[var(--content-padding-x)]">
            <div v-if="results.videos?.length === 0" class="text-center py-12 text-neutral-400">
              <i class="ri-video-line text-4xl opacity-30 mb-2" />
              <p class="text-sm">No videos found for "{{ lastQuery }}"</p>
            </div>
            <div
              v-else
              class="flex flex-col gap-1 bg-neutral-100/80 dark:bg-neutral-900/50 rounded-3xl p-2"
            >
              <div
                v-for="(video, idx) in results.videos"
                :key="video.id"
                class="search-result-row group flex items-center gap-4 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer rounded-2xl"
                :style="{ animationDelay: idx * 0.02 + 's' }"
                @click="playSong(video)"
              >
                <div
                  class="relative w-20 h-11 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                >
                  <i
                    class="ri-image-line absolute inset-0 flex items-center justify-center text-neutral-400 text-2xl"
                  ></i>
                  <img
                    :src="video.picUrl"
                    :alt="video.name"
                    @error="\$event.target.style.opacity=0"
                    class="relative z-10 w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div
                    class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <i class="ri-play-fill text-white text-sm" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors"
                  >
                    {{ video.name }}
                  </p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
                    {{ (video.artists || []).map((a) => a.name).join(', ') }}
                  </p>
                </div>
                <span
                  v-if="formatTime(video.dt)"
                  class="text-xs text-neutral-400 flex-shrink-0 tabular-nums"
                >
                  {{ formatTime(video.dt) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Idle: History + Moods ──────────────────────────────── -->
        <div v-else class="space-y-12 px-[var(--content-padding-x)]">
          <!-- Search history -->
          <section v-if="searchHistory.length > 0">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-neutral-900 dark:text-white">Recent Searches</h2>
              <button
                class="text-xs text-neutral-400 hover:text-red-500 transition-colors font-medium"
                @click="clearHistory"
              >
                Clear all
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="(item, i) in searchHistory"
                :key="i"
                class="group relative flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                @click="selectSuggestion(item)"
              >
                <i class="ri-time-line text-neutral-400 text-xs" />
                <span>{{ item }}</span>
                <i
                  class="ri-close-line text-neutral-400 hover:text-red-500 transition-colors text-xs"
                  @click.stop="removeHistory(item)"
                />
              </button>
            </div>
          </section>

          <!-- Moods & Genres -->
          <template v-if="moodsLoading">
            <section>
              <h2 class="text-lg font-bold text-neutral-900 dark:text-white mb-5">
                Moods &amp; Genres
              </h2>
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                <div v-for="i in 12" :key="i" class="h-12 skeleton-shimmer rounded-lg" />
              </div>
            </section>
          </template>
          <template v-else>
            <section v-for="(category, catIndex) in moods" :key="catIndex" class="mb-8">
              <h2 class="text-lg font-bold text-neutral-900 dark:text-white mb-5">
                {{ category.title }}
              </h2>
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                <button
                  v-for="(mood, i) in category.items"
                  :key="mood.id"
                  class="mood-pill group relative h-12 rounded-md overflow-hidden text-white cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-start px-3"
                  :style="{ backgroundColor: getMoodColor(mood.title) }"
                  @click="searchByMood(mood)"
                >
                  <span class="text-sm font-medium truncate w-full text-left">
                    {{ mood.title }}
                  </span>
                </button>
              </div>
            </section>
          </template>
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { NScrollbar, NSelect } from 'naive-ui';
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import type { SearchFilter, SearchResults } from '@/api/provider';
import { getProvider } from '@/api/providers';
import { getYTMMoods, type YTMMood, type YTMMoodCategory } from '@/api/ytmusic';
import logoImg from '@/assets/logo.png';
import { useQueueStore } from '@/store/modules/queue';
import type { SongResult } from '@/types/music';
import { secondToMinute } from '@/utils';

defineOptions({ name: 'Search' });

const SEARCH_TABS = [
  { key: 'all', label: 'All' },
  { key: 'songs', label: 'Songs' },
  { key: 'videos', label: 'Videos' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
  { key: 'playlists', label: 'Playlists' }
] as const;

const HISTORY_KEY = 'ytm_search_history';
const MAX_HISTORY = 20;
const SUGGESTION_DEBOUNCE = 350;

const query = ref('');
const lastQuery = ref('');
const suggestions = ref<string[]>([]);
const searchDone = ref(false);
const searchLoading = ref(false);
const activeTab = ref<'all' | 'songs' | 'videos' | 'albums' | 'artists' | 'playlists'>('all');
const results = ref<SearchResults & { total?: number }>({
  topResult: undefined,
  songs: [],
  playlists: [],
  albums: [],
  artists: [],
  videos: [],
  total: 0
});

const moods = ref<YTMMoodCategory[]>([]);
const moodsLoading = ref(false);
const searchHistory = ref<string[]>([]);

const searchInputRef = ref<HTMLInputElement | null>(null);
const suggestDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const playlistStore = useQueueStore();
const router = useRouter();

const formatTime = (time?: number | string) => {
  if (!time) return '';
  if (typeof time === 'string') {
    if (time.includes(':')) return time;
    return secondToMinute(Number(time) / 1000);
  }
  return secondToMinute(time / 1000);
};

function getTabCount(key: string): number {
  if (key === 'songs') return results.value.songs?.length || 0;
  if (key === 'playlists') return results.value.playlists?.length || 0;
  if (key === 'albums') return results.value.albums?.length || 0;
  if (key === 'artists') return results.value.artists?.length || 0;
  if (key === 'videos') return results.value.videos?.length || 0;
  return 0;
}

function onImgError(event: Event, title: string) {
  (event.target as HTMLImageElement).src = getPlaceholder(title);
}

let suggestAbortController: AbortController | null = null;

function onQueryInput() {
  if (suggestAbortController) suggestAbortController.abort();
  suggestAbortController = new AbortController();
  if (!query.value.trim()) {
    suggestions.value = [];
    return;
  }
  suggestDebounceTimer.value = setTimeout(
    async () => {
      try {
        const provider = getProvider();
        suggestions.value = await provider.getSuggestions(query.value.trim());
      } catch {
        // request cancelled - ignore
      }
    },
    SUGGESTION_DEBOUNCE,
    { signal: suggestAbortController.signal }
  );
}

function clearQuery() {
  query.value = '';
  suggestions.value = [];
  searchDone.value = false;
  results.value = {
    topResult: undefined,
    songs: [],
    playlists: [],
    albums: [],
    artists: [],
    videos: [],
    total: 0
  };
}

function selectSuggestion(q: string) {
  query.value = q;
  suggestions.value = [];
  doSearch();
}

function switchTab(tab: 'all' | 'songs' | 'videos' | 'albums' | 'artists' | 'playlists') {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  if (query.value.trim()) {
    doSearch(false);
  }
}

async function doSearch(clearResults = true) {
  const q = query.value.trim();
  if (!q) return;
  suggestions.value = [];
  saveHistory(q);
  lastQuery.value = q;
  searchDone.value = true;
  searchLoading.value = true;

  if (clearResults) {
    results.value = {
      topResult: undefined,
      songs: [],
      playlists: [],
      albums: [],
      artists: [],
      videos: [],
      total: 0
    };
    activeTab.value = 'all';
  }

  try {
    const provider = getProvider();
    const res = await provider.search({
      keywords: q,
      type: activeTab.value === 'all' ? undefined : (activeTab.value as SearchFilter)
    });

    if (activeTab.value === 'all') {
      results.value = res;
    } else {
      results.value[activeTab.value] = res[activeTab.value] as never;
    }
  } catch (e) {
    console.error(e);
  } finally {
    searchLoading.value = false;
  }
}

function searchByMood(mood: YTMMood) {
  router.push({
    name: 'moodDetail',
    params: { id: mood.id },
    query: { params: mood.params, title: mood.title }
  });
}

function playSong(song: SongResult) {
  playlistStore.setQueue([song], false, false);
  window.dispatchEvent(new CustomEvent('ytm:play', { detail: song }));
}

function goToArtist(id: string) {
  router.push({ name: 'artistDetail', params: { id } });
}

function goToPlaylist(id: string) {
  router.push({ name: 'playlistDetail', params: { id } });
}

function onTopResultClick() {
  if (!results.value.topResult) return;
  if ('artists' in results.value.topResult) {
    playSong(results.value.topResult as SongResult);
  } else if ((results.value.topResult as any).type === 'artist') {
    goToArtist(results.value.topResult.id);
  } else {
    goToPlaylist(results.value.topResult.id);
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    searchHistory.value = raw ? JSON.parse(raw) : [];
  } catch {
    searchHistory.value = [];
  }
}

function saveHistory(q: string) {
  searchHistory.value = [q, ...searchHistory.value.filter((h) => h !== q)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
}

function removeHistory(q: string) {
  searchHistory.value = searchHistory.value.filter((h) => h !== q);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value));
}

function clearHistory() {
  searchHistory.value = [];
  localStorage.removeItem(HISTORY_KEY);
}

// ─── Moods ────────────────────────────────────────────────────────────────────

function getStringHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

const moodColors = [
  '#E91E63',
  '#9C27B0',
  '#673AB7',
  '#3F51B5',
  '#2196F3',
  '#00BCD4',
  '#009688',
  '#4CAF50',
  '#FF9800',
  '#FF5722',
  '#795548',
  '#607D8B'
];

function getMoodColor(title: string): string {
  const hash = Math.abs(getStringHashCode(title));
  return moodColors[hash % moodColors.length];
}

async function loadMoods() {
  moodsLoading.value = true;
  try {
    moods.value = await getYTMMoods();
  } catch {
    moods.value = [];
  } finally {
    moodsLoading.value = false;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  loadHistory();
  loadMoods();
  searchInputRef.value?.focus();
});
</script>

<style lang="scss" scoped>
.search-page {
  position: relative;
}

.search-result-row {
  animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.mood-pill {
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

.ytm-playlist-card {
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.no-scrollbar {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
</style>
