<template>
  <n-dropdown
    v-if="isDesktop()"
    :show="show"
    :x="x"
    :y="y"
    :options="dropdownOptions"
    :z-index="99999999"
    placement="bottom-start"
    @clickoutside="$emit('update:show', false)"
    @select="handleSelect"
    class="rounded-xl"
  />
</template>

<script lang="ts" setup>
import type { MenuOption } from 'naive-ui';
import { createDiscreteApi, NDropdown, NEllipsis, NImage } from 'naive-ui';
import { computed, h } from 'vue';

import type { SongResult } from '@/types/music';
import { getImgUrl, isDesktop } from '@/utils';

const { message } = createDiscreteApi(['message']);

const props = defineProps<{
  item: SongResult;
  show: boolean;
  x: number;
  y: number;
  isFavorite: boolean;
  isDislike: boolean;
  canRemove?: boolean;
}>();

const emits = defineEmits([
  'update:show',
  'select',
  'play',
  'play-next',
  'download',
  'download-lyric',
  'toggle-favorite',
  'toggle-dislike',
  'remove'
]);

const isLocalSong = computed(
  () =>
    typeof props.item.playMusicUrl === 'string' && props.item.playMusicUrl.startsWith('local://')
);

const renderSongPreview = () => {
  return h(
    'div',
    {
      class: 'flex items-center gap-3 px-2 dark:border-gray-800 dark:text-white'
    },
    [
      h(NImage, {
        src: getImgUrl(props.item.picUrl || props.item.al?.picUrl, '100y100'),
        class: 'w-10 h-10 rounded-lg flex-shrink-0',
        previewDisabled: true,
        imgProps: {
          crossorigin: 'anonymous'
        }
      }),
      h(
        'div',
        {
          class: 'flex-1 min-w-0 py-1 overflow-hidden'
        },
        [
          h(
            'div',
            {
              class: 'mb-1 overflow-hidden'
            },
            [
              h(
                NEllipsis,
                {
                  lineClamp: 1,
                  depth: 1,
                  class: 'text-sm font-medium w-full',
                  style: 'max-width: 150px; min-width: 120px;'
                },
                {
                  default: () => props.item.name
                }
              )
            ]
          ),
          h(
            'div',
            {
              class: 'text-xs text-gray-500 dark:text-gray-400 overflow-hidden'
            },
            [
              h(
                NEllipsis,
                {
                  lineClamp: 1,
                  style: 'max-width: 150px;'
                },
                {
                  default: () => {
                    const artistNames = (props.item.ar || props.item.artists)
                      ?.map((a) => a.name)
                      .join(' / ');
                    return artistNames || 'unknown artist';
                  }
                }
              )
            ]
          )
        ]
      )
    ]
  );
};

const dropdownOptions = computed<MenuOption[]>(() => {
  const options: MenuOption[] = [
    {
      key: 'header',
      type: 'render',
      render: renderSongPreview
    },
    {
      key: 'divider1',
      type: 'divider'
    },
    {
      label: 'Play',
      key: 'play',
      icon: () => h('i', { class: 'iconfont ri-play-circle-line' })
    },
    {
      label: 'Play Next',
      key: 'playNext',
      icon: () => h('i', { class: 'iconfont ri-play-list-2-line' })
    },
    {
      type: 'divider',
      key: 'd1'
    },
    {
      label: 'Download',
      key: 'download',
      icon: () => h('i', { class: 'iconfont ri-download-line' })
    },
    {
      label: 'Download Lyrics',
      key: 'downloadLyric',
      icon: () => h('i', { class: 'iconfont ri-file-text-line' })
    },
    {
      label: props.isFavorite ? 'Unlike' : 'Like',
      key: 'favorite',
      icon: () =>
        h('i', {
          class: `iconfont ${props.isFavorite ? 'ri-heart-fill text-red-500' : 'ri-heart-line'}`
        })
    },
    {
      label: props.isDislike ? 'Undislike' : 'Dislike',
      key: 'dislike',
      icon: () =>
        h('i', {
          class: `iconfont ${props.isDislike ? 'ri-dislike-fill text-primary' : 'ri-dislike-line'}`
        })
    }
  ];

  if (props.canRemove) {
    options.push(
      {
        type: 'divider',
        key: 'd2'
      },
      {
        label: isLocalSong.value ? 'Remove from Library' : 'Remove from Playlist',
        key: 'remove',
        icon: () => h('i', { class: 'iconfont ri-delete-bin-line' })
      }
    );
  }

  return options;
});

const handleSelect = (key: string | number) => {
  emits('update:show', false);

  switch (key) {
    case 'download':
      emits('download');
      break;
    case 'downloadLyric':
      emits('download-lyric');
      break;
    case 'playNext':
      emits('play-next');
      break;
    case 'favorite':
      emits('toggle-favorite');
      break;
    case 'play':
      emits('play');
      break;
    case 'remove':
      emits('remove', props.item.id);
      break;
    case 'dislike':
      emits('toggle-dislike');
      break;
    default:
      break;
  }
};
</script>

<style lang="scss" scoped>
:deep(.n-dropdown-menu) {
  @apply min-w-[240px] overflow-hidden rounded-lg border dark:border-gray-800;

  .n-dropdown-option {
    @apply h-9 text-sm;

    &:hover {
      @apply bg-gray-100 dark:bg-gray-800;
    }

    .n-dropdown-option-body {
      @apply h-full;

      .n-dropdown-option-body__prefix {
        @apply w-8 flex justify-center items-center;

        .iconfont {
          @apply text-base;
        }
      }
    }
  }

  .n-dropdown-divider {
    @apply my-1;
  }
}

:deep(.n-dropdown-option-body--render) {
  @apply p-0;
}
</style>
