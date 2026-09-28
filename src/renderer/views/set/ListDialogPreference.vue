<template>
  <div>
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

    <n-modal v-model:show="showModal" preset="card" class="max-w-[400px]" :title="title" :bordered="false" size="huge">
      <div class="flex flex-col space-y-2 py-2">
        <div 
          v-for="option in options" 
          :key="option.value"
          class="flex items-center space-x-4 p-4 rounded-xl cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          @click="selectOption(option.value)"
        >
          <n-radio :checked="value === option.value" :value="option.value" @change="selectOption(option.value)" />
          <span class="text-base font-medium">{{ option.label }}</span>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <n-button @click="showModal = false">Cancel</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { NModal, NRadio, NButton } from 'naive-ui';
import SettingItem from './SettingItem.vue';

const props = defineProps<{
  title: string;
  description?: string;
  value: string | number;
  options: Array<{ label: string; value: string | number }>;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:value': [value: string | number];
}>();

const showModal = ref(false);

const selectedLabel = computed(() => {
  const opt = props.options.find(o => o.value === props.value);
  return opt ? opt.label : props.value;
});

const openDialog = () => {
  if (!props.disabled) {
    showModal.value = true;
  }
};

const selectOption = (val: string | number) => {
  emit('update:value', val);
  showModal.value = false;
};
</script>
