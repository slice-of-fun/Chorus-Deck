<template>
  <div :id="id" :ref="setRef" class="mb-6 w-full flex flex-col">
    <div v-if="title || $slots.title" class="text-sm font-semibold mb-2 mt-2 text-primary px-2">
      <slot name="title">{{ title }}</slot>
    </div>

    <div class="flex flex-col gap-1 w-full">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type ComponentPublicInstance } from 'vue';

defineOptions({
  name: 'SettingSection'
});

interface Props {
  id?: string;
  title?: string;
}

withDefaults(defineProps<Props>(), {
  id: '',
  title: ''
});

const emit = defineEmits<{
  ref: [el: Element | null];
}>();

const setRef = (el: Element | ComponentPublicInstance | null) => {
  emit('ref', el as Element | null);
};
</script>
