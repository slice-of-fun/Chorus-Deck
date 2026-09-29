import { useMessage } from 'naive-ui';
import { computed, ref } from 'vue';

import { usePlayerStore } from '@/store';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { t } from '@/utils/i18n';
import { getImageBackground } from '@/utils/linearColor';

import { useArtist } from './useArtist';
import { useDownload } from './useDownload';

export function useSongItem(props: { item: SongResult; canRemove?: boolean }) {
  const playerStore = usePlayerStore();
  const message = useMessage();
  const { downloadMusic } = useDownload();
  const { navigateToArtist } = useArtist();

  const showDropdown = ref(false);
  const dropdownX = ref(0);
  const dropdownY = ref(0);
  const isHovering = ref(false);

  const play = computed(() => playerStore.isPlay);
  const playMusic = computed(() => playerStore.playMusic);
  const playLoading = computed(
    () => playMusic.value.id === props.item.id && playMusic.value.playLoading
  );
  const isPlaying = computed(() => playMusic.value.id === props.item.id);

  const isFavorite = computed(() => playerStore.favoriteIds.includes(props.item.id));

  const isDislike = computed(() => playerStore.dislikeList.includes(props.item.id));

  const artists = computed(() => {
    return (props.item.ar || props.item.artists)?.slice(0, 4) || [];
  });

  const handleImageLoad = async (imageElement: HTMLImageElement) => {
    if (!imageElement) return;

    const { backgroundColor, primaryColor } = await getImageBackground(imageElement);
    props.item.backgroundColor = backgroundColor;
    props.item.primaryColor = primaryColor;
  };

  const playMusicEvent = async (item: SongResult) => {
    try {
      const result = await playerStore.setPlay(item);
      if (!result) {
        throw new Error('Play failed');
      }
      return true;
    } catch (error) {
      console.error('Playback error:', error);
      return false;
    }
  };

  const toggleFavorite = async (e: Event) => {
    e && e.stopPropagation();

    if (isFavorite.value) {
      playerStore.removeFromFavorite(props.item.id);
    } else {
      playerStore.addToFavorite(props.item);
    }
  };

  const toggleDislike = async (e: Event) => {
    e && e.stopPropagation();

    if (isDislike.value) {
      playerStore.removeFromDislikeList(props.item.id);
    } else {
      playerStore.addToDislikeList(props.item.id);
    }
  };

  const handlePlayNext = () => {
    playerStore.addToNextPlay(props.item);
    message.success('Added to play next');
  };

  const getDuration = (item: SongResult): number => {
    if (item.duration) return item.duration;
    if (typeof item.dt === 'number') return item.dt;
    return 0;
  };

  const formatDuration = (ms: number): string => {
    if (!ms) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    showDropdown.value = true;
    dropdownX.value = e.clientX;
    dropdownY.value = e.clientY;
  };

  const handleMenuClick = (e: MouseEvent) => {
    e.preventDefault();
    showDropdown.value = true;
    dropdownX.value = e.clientX;
    dropdownY.value = e.clientY;
  };

  const handleArtistClick = (id: string) => {
    navigateToArtist(id);
  };

  const handleMouseEnter = () => {
    isHovering.value = true;
  };

  const handleMouseLeave = () => {
    isHovering.value = false;
  };

  return {
    t,
    play,
    playMusic,
    playLoading,
    isPlaying,
    isFavorite,
    isDislike,
    artists,
    showDropdown,
    dropdownX,
    dropdownY,
    isHovering,
    playerStore,
    message,
    getImgUrl,
    handleImageLoad,
    playMusicEvent,
    toggleFavorite,
    toggleDislike,
    handlePlayNext,
    getDuration,
    formatDuration,
    handleContextMenu,
    handleMenuClick,
    handleArtistClick,
    handleMouseEnter,
    handleMouseLeave,
    downloadMusic
  };
}
