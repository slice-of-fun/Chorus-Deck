<template>
  <component :is="componentToUse" v-bind="$attrs" ref="musicFullRef" />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import MusicFull from '@/components/lyric/MusicFull.vue';
import MusicFullMobile from '@/components/lyric/MusicFullMobile.vue';
import { isMobile } from '@/utils';

const componentToUse = computed(() => {
  return isMobile.value ? MusicFullMobile : MusicFull;
});

const musicFullRef = ref<InstanceType<typeof MusicFull>>();

defineExpose({
  musicFullRef
});
</script>
