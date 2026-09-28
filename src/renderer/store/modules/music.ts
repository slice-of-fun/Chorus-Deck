import { defineStore } from 'pinia';

interface MusicState {
  currentMusicList: any[] | null;
  currentMusicListName: string;
  currentListInfo: any | null;
  canRemoveSong: boolean;
}

export const useMusicStore = defineStore('music', {
  state: (): MusicState => ({
    currentMusicList: null,
    currentMusicListName: '',
    currentListInfo: null,
    canRemoveSong: false
  }),

  actions: {
    setCurrentMusicList(list: any[], name: string, listInfo: any = null, canRemove = false) {
      this.currentMusicList = list;
      this.currentMusicListName = name;
      this.currentListInfo = listInfo;
      this.canRemoveSong = canRemove;
    },

    setBasicListInfo(name: string, listInfo: any = null, canRemove = false) {
      this.currentMusicList = null;
      this.currentMusicListName = name;
      this.currentListInfo = listInfo;
      this.canRemoveSong = canRemove;
    },

    clearCurrentMusicList() {
      this.currentMusicList = null;
      this.currentMusicListName = '';
      this.currentListInfo = null;
      this.canRemoveSong = false;
    },

    removeSongFromList(id: string) {
      if (!this.currentMusicList) return;

      const index = this.currentMusicList.findIndex((song) => song.id === id);
      if (index !== -1) {
        this.currentMusicList.splice(index, 1);
      }
    }
  }
});
