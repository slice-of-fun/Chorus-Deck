<template>
  <component
    :is="renderComponent"
    :item="item"
    :favorite="favorite"
    :selectable="selectable"
    :selected="selected"
    :can-remove="canRemove"
    :is-next="isNext"
    :index="index"
    @play="(...args) => $emit('play', ...args)"
    @select="(...args) => $emit('select', ...args)"
    @remove-song="(...args) => $emit('remove-song', ...args)"
  />
</template>

<script lang="ts" setup>
import { computed } from 'vue';

import type { SongResult } from '@/types/music';

import CompactSongItem from './songItemCom/CompactSongItem.vue';
import HomeSongItem from './songItemCom/HomeSongItem.vue';
import ListSongItem from './songItemCom/ListSongItem.vue';
import StandardSongItem from './songItemCom/StandardSongItem.vue';

const props = withDefaults(
  defineProps<{
    item: SongResult;
    list?: boolean;
    compact?: boolean;
    home?: boolean;
    favorite?: boolean;
    selectable?: boolean;
    selected?: boolean;
    canRemove?: boolean;
    isNext?: boolean;
    index?: number;
  }>(),
  {
    list: false,
    compact: false,
    home: false,
    favorite: true,
    selectable: false,
    selected: false,
    canRemove: false,
    isNext: false,
    index: undefined
  }
);

defineEmits(['play', 'select', 'remove-song']);

const renderComponent = computed(() => {
  if (props.list) return ListSongItem;
  if (props.compact) return CompactSongItem;
  if (props.home) return HomeSongItem;
  return StandardSongItem;
});
</script>
