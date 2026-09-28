import { useMessage } from 'naive-ui';
import { ref } from 'vue';

import { getSongStream } from '@/hooks/usePlayerHooks';
import { useDownloadStore } from '@/store/modules/download';
import type { SongResult } from '@/types/music';

import type { DownloadSongInfo } from '../../shared/download';
import { guessAudioExtension } from '../../shared/download';

function toDownloadSongInfo(song: SongResult, mimeType: string): DownloadSongInfo {
  return {
    id: song.id,
    name: song.name,
    picUrl: song.picUrl ?? song.al?.picUrl ?? '',
    ar: (song.ar || song.artists || []).map((a: { name: string }) => ({ name: a.name })),
    al: {
      name: song.al?.name ?? '',
      picUrl: song.al?.picUrl ?? ''
    },
    mimeType
  };
}

export const useDownload = () => {
  const message = useMessage();
  const downloadStore = useDownloadStore();
  const isDownloading = ref(false);

  const downloadMusic = async (song: SongResult) => {
    if (isDownloading.value) {
      message.warning('Downloading, please wait...');
      return;
    }

    try {
      isDownloading.value = true;

      const stream = await getSongStream(song.id, song, true);

      if (!stream.url || stream.isLocal) {
        throw new Error(
          stream.isLocal
            ? 'This track is already a local file'
            : 'Failed to resolve an audio stream for this track'
        );
      }

      const songInfo = toDownloadSongInfo(song, stream.mimeType);
      await downloadStore.addDownload(songInfo, stream.url, guessAudioExtension(stream.mimeType));
      message.success('Added to download queue');
    } catch (error: any) {
      console.error('Download error:', error);
      message.error(error?.message || 'Download failed');
    } finally {
      isDownloading.value = false;
    }
  };

  const batchDownloadMusic = async (songs: SongResult[]) => {
    if (isDownloading.value) {
      message.warning('Downloading, please wait...');
      return;
    }

    if (songs.length === 0) {
      message.warning('Please select songs to download first');
      return;
    }

    try {
      isDownloading.value = true;
      message.success('Resolving streams, please wait...');

      const BATCH_SIZE = 5;
      const resolvedItems: Array<{ songInfo: DownloadSongInfo; url: string; type: string }> = [];

      for (let i = 0; i < songs.length; i += BATCH_SIZE) {
        const chunk = songs.slice(i, i + BATCH_SIZE);
        const chunkResults = await Promise.all(
          chunk.map(async (song) => {
            try {
              const stream = await getSongStream(song.id, song, true);
              if (!stream.url || stream.isLocal) return null;
              return {
                songInfo: toDownloadSongInfo(song, stream.mimeType),
                url: stream.url,
                type: guessAudioExtension(stream.mimeType)
              };
            } catch (error) {
              console.error(`Failed to resolve stream for "${song.name}":`, error);
              return null;
            }
          })
        );
        for (const item of chunkResults) {
          if (item) resolvedItems.push(item);
        }
      }

      if (resolvedItems.length > 0) {
        await downloadStore.batchDownload(resolvedItems);
      } else {
        message.warning('No playable streams could be resolved');
      }
    } catch (error) {
      console.error('Download failed:', error);
      message.destroyAll();
      message.error('Download failed');
    } finally {
      isDownloading.value = false;
    }
  };

  return {
    isDownloading,
    downloadMusic,
    batchDownloadMusic
  };
};
