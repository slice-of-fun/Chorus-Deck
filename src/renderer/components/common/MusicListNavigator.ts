import { Router } from 'vue-router';

import { useMusicStore } from '@/store/modules/music';

export function navigateToMusicList(
  router: Router,
  options: {
    id?: string | number;
    type?: 'album' | 'playlist' | string;
    name: string;
    songList?: any[];
    listInfo?: any;
    canRemove?: boolean;
  }
) {
  const musicStore = useMusicStore();
  const { id, type, name, songList, listInfo, canRemove = false } = options;

  if (songList) {
    musicStore.setCurrentMusicList(songList, name, listInfo, canRemove);
  } else {
    musicStore.setBasicListInfo(name, listInfo, canRemove);
  }

  if (id) {
    router.push({
      name: 'playlistDetail',
      params: { id },
      query: { type }
    });
  } else {
    router.push({ name: 'home' });
  }
}
