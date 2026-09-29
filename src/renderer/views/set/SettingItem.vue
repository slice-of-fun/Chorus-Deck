<template>
  <div
    class="setting-item flex items-center justify-between p-4 mb-1 transition-all duration-200 text-gray-900 dark:text-white bg-gray-100/50 dark:bg-white/5 border border-transparent"
    :class="[
      { 'max-md:flex-col max-md:items-start max-md:gap-3': !inline },
      {
        'cursor-pointer hover:bg-gray-200/50 hover:dark:bg-white/10 active:scale-[0.99]': clickable
      },
      customClass
    ]"
    @click="handleClick"
  >
    <div class="flex-1 min-w-0 mr-4 flex items-center gap-4">
      <div
        v-if="icon"
        class="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-primary/10 text-primary"
      >
        <i :class="[icon, 'text-xl']"></i>
      </div>
      <div
        v-if="$slots.icon"
        class="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-primary/10 text-primary"
      >
        <slot name="icon"></slot>
      </div>

      <div class="flex-1 min-w-0">
        <div class="text-[15px] font-medium mb-0.5">
          <slot name="title">{{ title }}</slot>
        </div>
        <div
          v-if="description || $slots.description"
          class="text-sm text-gray-500 dark:text-gray-400 leading-snug"
        >
          <slot name="description">{{ description }}</slot>
        </div>

        <div v-if="$slots.extra" class="mt-2">
          <slot name="extra"></slot>
        </div>
      </div>
    </div>

    <div
      v-if="$slots.action || $slots.default"
      class="flex items-center gap-2 flex-shrink-0"
      :class="{ 'max-md:w-full max-md:justify-end': !inline }"
    >
      <slot name="action">
        <slot></slot>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'SettingItem'
});

interface Props {
  title?: string;
  description?: string;
  icon?: string;
  clickable?: boolean;
  inline?: boolean;
  customClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  description: '',
  icon: '',
  clickable: false,
  inline: false,
  customClass: ''
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const handleClick = (event: MouseEvent) => {
  if (props.clickable) {
    emit('click', event);
  }
};
</script>

<style scoped>
.setting-item {
  border-radius: 6px;
}
.setting-item:first-child {
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
}
.setting-item:last-child {
  border-bottom-left-radius: 24px;
  border-bottom-right-radius: 24px;
  margin-bottom: 0;
}
.setting-item:first-child:last-child {
  border-radius: 24px;
}
</style>
