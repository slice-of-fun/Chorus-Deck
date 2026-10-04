<template>
  <component :is="componentToUse" v-bind="$attrs" ref="musicFullRef" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import MusicFull from '@/components/lyric/MusicFull.vue';
import MusicFullCompact from '@/components/lyric/MusicFullCompact.vue';
import { isCompact } from '@/utils';

const componentToUse = computed(() => {
  return isCompact.value ? MusicFullCompact : MusicFull;
});

const musicFullRef = ref<InstanceType<typeof MusicFull>>();

defineExpose({
  musicFullRef
});
</script>
