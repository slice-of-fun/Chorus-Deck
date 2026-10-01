<template>
  <base-song-item
    :item="item"
    :selectable="selectable"
    :selected="selected"
    :can-remove="canRemove"
    :is-next="isNext"
    :index="index"
    @play="(...args) => $emit('play', ...args)"
    @select="(...args) => $emit('select', ...args)"
    @remove-song="(...args) => $emit('remove-song', ...args)"
    class="list-song-item"
    ref="baseItem"
  >
    <template #select>
      <div v-if="baseItem && selectable" class="song-item-select" @click.stop="onToggleSelect">
        <n-checkbox :checked="selected" />
      </div>
    </template>

    <template #image>
      <n-image
        v-if="item.picUrl"
        :src="getImgUrl(item.picUrl, '100y100')"
        class="song-item-img"
        preview-disabled
        :img-props="{
          crossorigin: 'anonymous'
        }"
        @load="onImageLoad"
      />
    </template>

    <template #content>
      <div class="song-item-content">
        <div class="song-item-content-wrapper">
          <n-ellipsis
            class="song-item-content-title text-ellipsis"
            line-clamp="1"
            :class="{ 'text-primary': isPlaying }"
          >
            {{ item.name }}
            <span
              v-if="item.tns?.length || item.alia?.length"
              class="text-neutral-400 dark:text-neutral-500"
              >（{{ item.tns?.[0] || item.alia?.[0] }}）</span
            >
          </n-ellipsis>
          <div class="song-item-content-divider">-</div>
          <n-ellipsis class="song-item-content-name text-ellipsis" line-clamp="1">
            <template v-for="(artist, index) in artists" :key="index">
              <span
                class="cursor-pointer hover:text-primary"
                @click.stop="onArtistClick(artist.id)"
                >{{ artist.name }}</span
              >
              <span v-if="index < artists.length - 1"> / </span>
            </template>
          </n-ellipsis>
        </div>
      </div>
    </template>

    <template #operating>
      <div class="song-item-operating-list">
        <div v-if="favorite" class="song-item-operating-list-like">
          <i
            class="ri-heart-fill"
            :class="{ 'like-active': isFavorite }"
            @click.stop="onToggleFavorite"
          ></i>
        </div>
        <div
          class="song-item-operating-list-play bg-gray-300 dark:bg-gray-800 animate__animated"
          :class="{ 'text-primary': isPlaying, animate__flipInY: playLoading }"
          @click="onPlayMusic"
        >
          <i v-if="isPlaying && play" class="ri-pause-fill"></i>
          <i v-else class="ri-play-fill"></i>
        </div>
      </div>
    </template>
  </base-song-item>
</template>

<script lang="ts" setup>
import { NCheckbox, NEllipsis, NImage } from 'naive-ui';
import { computed, ref } from 'vue';

import { usePlayerStore } from '@/store';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

import BaseSongItem from './BaseSongItem.vue';

const playerStore = usePlayerStore();

const props = withDefaults(
  defineProps<{
    item: SongResult;
    favorite?: boolean;
    selectable?: boolean;
    selected?: boolean;
    canRemove?: boolean;
    isNext?: boolean;
    index?: number;
  }>(),
  {
    favorite: true,
    selectable: false,
    selected: false,
    canRemove: false,
    isNext: false,
    index: undefined
  }
);

const emit = defineEmits(['play', 'select', 'remove-song']);
const baseItem = ref<InstanceType<typeof BaseSongItem>>();

const play = computed(() => playerStore.isPlay);
const isPlaying = computed(() => baseItem.value?.isPlaying || false);
const playLoading = computed(() => baseItem.value?.playLoading || false);
const isFavorite = computed(() => baseItem.value?.isFavorite || false);
const artists = computed(() => baseItem.value?.artists || []);

const onToggleSelect = () => {
  baseItem.value?.toggleSelect();
  emit('select', props.item.id, !props.selected);
};
const onImageLoad = (event: Event) => baseItem.value?.imageLoad(event);
const onArtistClick = (id: string | undefined) => {
  if (id) baseItem.value?.handleArtistClick(id);
};
const onToggleFavorite = (event: Event) => {
  baseItem.value?.toggleFavorite(event);
};
const onPlayMusic = () => {
  baseItem.value?.playMusicEvent(props.item);
  emit('play', props.item);
};
</script>

<style lang="scss" scoped>
.list-song-item {
  padding: 0.5rem;
  border-radius: 0.75rem;
  margin-bottom: 0.5rem;
  border-width: 1px;
  border-color: rgb(229 231 235);

  &:hover {
    background-color: rgb(249 250 251);
  }

  .song-item-img {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.75rem;
    margin-right: 0.75rem;
  }

  .song-item-content {
    display: flex;
    align-items: center;
    flex: 1;

    &-wrapper {
      display: flex;
      align-items: center;
      flex: 1;
      font-size: 0.875rem;
      line-height: 1.25rem;
    }

    &-title {
      flex-shrink: 0;
      max-width: 45%;
      color: rgb(17 24 39);
    }

    &-divider {
      margin-left: 0.5rem;
      margin-right: 0.5rem;
      color: rgb(107 114 128);
    }

    &-name {
      flex: 1;
      min-width: 0;
      color: rgb(107 114 128);
    }
  }

  .song-item-operating-list {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    &-like {
      cursor: pointer;
      transition-property: transform;
      transition-duration: 0.15s;

      &:hover {
        transform: scale(1.1);
      }

      .iconfont {
        font-size: 1rem;
        color: rgb(107 114 128);

        &:hover {
          color: rgb(239 68 68);
        }
      }

      .like-active {
        color: rgb(239 68 68) !important;
      }
    }

    &-play {
      width: 1.75rem;
      height: 1.75rem;
      cursor: pointer;
      transition-property: transform;
      transition-duration: 0.15s;
      border-radius: 9999px;
      display: flex;
      justify-content: center;
      align-items: center;

      &:hover {
        transform: scale(1.1);
      }

      .iconfont {
        font-size: 1rem;
      }

      &.text-primary {
        background-color: rgb(34 197 94);
        color: white;
      }
    }
  }
}

.dark .list-song-item {
  border-color: rgb(31 41 55);

  &:hover {
    background-color: rgb(31 41 55);
  }

  .song-item-content {
    &-title {
      color: white;
    }

    &-divider,
    &-name {
      color: rgb(156 163 175);
    }
  }

  .song-item-operating-list-like .iconfont {
    color: rgb(156 163 175);
  }
}
</style>
