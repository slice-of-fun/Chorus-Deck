<template>
  <setting-item
    :title="title"
    :clickable="!disabled"
    @click="openDialog"
    :class="{ 'opacity-50 pointer-events-none': disabled }"
  >
    <template #icon v-if="$slots.icon">
      <slot name="icon"></slot>
    </template>
    <template #description>
      <div class="flex flex-col">
        <span v-if="description">{{ description }}</span>
        <span class="text-primary mt-1">{{ selectedLabel }}</span>
      </div>
    </template>
  </setting-item>

  <n-modal v-model:show="showModal">
    <div
      class="bg-[#f0f3f8] dark:bg-[#1a1b1e] rounded-[28px] max-w-[340px] w-[90vw] overflow-hidden flex flex-col mx-auto shadow-2xl"
    >
      <div class="px-6 pt-6 pb-4 text-[24px] text-black dark:text-[#E3E2E6] font-normal leading-8">
        {{ title }}
      </div>
      <div class="flex flex-col py-1 overflow-y-auto max-h-[60vh]">
        <div
          v-for="option in options"
          :key="option.value"
          class="flex items-center space-x-4 mx-4 px-4 py-3.5 cursor-pointer transition-colors rounded-2xl mb-1"
          :class="
            value === option.value
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-black/5 dark:hover:bg-white/10'
          "
          @click="selectOption(option.value)"
        >
          <n-radio
            :checked="value === option.value"
            :value="option.value"
            @change="selectOption(option.value)"
          />
          <span
            class="text-[16px] font-normal"
            :class="
              value === option.value
                ? 'text-primary font-medium'
                : 'text-[#1C1B1F] dark:text-[#E3E2E6]'
            "
            >{{ option.label }}</span
          >
        </div>
      </div>
      <div class="flex justify-end px-6 pb-6">
        <n-button
          round
          text
          class="px-4 py-2 font-medium text-primary hover:bg-primary/10 rounded-full"
          @click="showModal = false"
          >Cancel</n-button
        >
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NModal, NRadio } from 'naive-ui';
import { computed, ref } from 'vue';

import SettingItem from './SettingItem.vue';

const props = defineProps<{
  title: string;
  description?: string;
  value?: any;
  options: Array<{ label: string; value: string | number }>;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:value': [value: string | number];
}>();

const showModal = ref(false);

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.value);
  return opt ? opt.label : props.value;
});

const openDialog = () => {
  if (!props.disabled) {
    showModal.value = true;
  }
};

const selectOption = (val: any) => {
  emit('update:value', val);
  showModal.value = false;
};
</script>
