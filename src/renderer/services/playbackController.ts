import { createDiscreteApi } from 'naive-ui';

import { loadLrc, useSongDetail } from '@/hooks/usePlayerHooks';
import { audioService } from '@/services/audioService';
import { playbackRequestManager } from '@/services/playbackRequestManager';
import type { SongResult } from '@/types/music';
import { getImageLinearBackground } from '@/utils/linearColor';
import { thumbTiny } from '@/utils/thumbnail';

const { message } = createDiscreteApi(['message']);

let generation = 0;

export const getCurrentGeneration = (): number => generation;

const getPlayerCoreStore = async () => {
  const { usePlayerCoreStore } = await import('@/store/modules/playerCore');
  return usePlayerCoreStore();
};

const getPlaylistStore = async () => {
  const { useQueueStore } = await import('@/store/modules/queue');
  return useQueueStore();
};

const getPlayHistoryStore = async () => {
  const { usePlayHistoryStore } = await import('@/store/modules/playHistory');
  return usePlayHistoryStore();
};

const getSettingsStore = async () => {
  const { useSettingsStore } = await import('@/store/modules/settings');
  return useSettingsStore();
};

const loadMetadata = async (
  music: SongResult
): Promise<{
  lyrics: SongResult['lyric'];
  backgroundColor: string;
  primaryColor: string;
}> => {
  const [lyrics, { backgroundColor, primaryColor }] = await Promise.all([
    (async () => {
      if (music.lyric && music.lyric.lrcTimeArray.length > 0) {
        return music.lyric;
      }
      return await loadLrc(music.id);
    })(),
    (async () => {
      if (music.backgroundColor && music.primaryColor) {
        return { backgroundColor: music.backgroundColor, primaryColor: music.primaryColor };
      }
      return await getImageLinearBackground(thumbTiny(music?.picUrl));
    })()
  ]);

  return { lyrics, backgroundColor, primaryColor };
};

const loadAndPlayAudio = async (song: SongResult, shouldPlay: boolean): Promise<boolean> => {
  if (!song.playMusicUrl) {
    throw new Error('Song is not playingURL');
  }

  let initialPosition = 0;
  const savedProgress = JSON.parse(localStorage.getItem('playProgress') || '{}');
  if (savedProgress.songId === song.id) {
    initialPosition = savedProgress.progress;
    console.log('[playbackController] Resume playback progress:', initialPosition);
  }

  console.log(`[playbackController] Start playing: ${song.name}`);
  await audioService.play(song.playMusicUrl, song, shouldPlay, initialPosition || 0);

  window.dispatchEvent(
    new CustomEvent('audio-ready', {
      detail: { shouldPlay }
    })
  );

  return true;
};

const triggerPreload = async (song: SongResult): Promise<void> => {
  try {
    const playlistStore = await getPlaylistStore();
    const list = playlistStore.queueItems;
    if (Array.isArray(list) && list.length > 0) {
      const idx = list.findIndex(
        (item: SongResult) => item.id === song.id && item.source === song.source
      );
      if (idx !== -1) {
        playlistStore.preloadNextSongs(idx);
      }
    }
  } catch (e) {
    console.warn(
      'Preloading trigger failed (maybe dependency not loaded or circular dependency), ignored:',
      e
    );
  }
};

const updateDocumentTitle = (music: SongResult): void => {
  let title = music.name;
  const artistNames = (music.ar || music.artists)?.map((a) => a.name).join('/');
  if (artistNames) {
    title += ` - ${artistNames}`;
  }
  document.title = 'Chorus Deck - ' + title;
};

export const playTrack = async (
  music: SongResult,
  shouldPlay: boolean = true
): Promise<boolean> => {
  const gen = ++generation;
  const requestId = playbackRequestManager.createRequest(music);
  console.log(
    `[playbackController] playTrack gen=${gen}, song: ${music.name}, requestId: ${requestId}`
  );

  const playerCore = await getPlayerCoreStore();
  audioService.stop();

  if (!playbackRequestManager.isRequestValid(requestId)) {
    console.log(`[playbackController] The request expires after it is created: ${requestId}`);
    return false;
  }
  if (!playbackRequestManager.activateRequest(requestId)) {
    console.log(`[playbackController] Unable to activate request: ${requestId}`);
    return false;
  }

  playerCore.play = shouldPlay;
  playerCore.isPlay = shouldPlay;
  playerCore.userPlayIntent = shouldPlay;

  music.playLoading = true;
  playerCore.playMusic = music;
  updateDocumentTitle(music);

  const originalMusic = { ...music };

  let loadedMetadata: {
    lyrics: SongResult['lyric'];
    backgroundColor: string;
    primaryColor: string;
  } | null = null;
  const applyLoadedMetadata = () => {
    if (!loadedMetadata || gen !== generation) return;
    playerCore.playMusic.lyric = loadedMetadata.lyrics;
    playerCore.playMusic.backgroundColor = loadedMetadata.backgroundColor;
    playerCore.playMusic.primaryColor = loadedMetadata.primaryColor;

    playerCore.playMusic = { ...playerCore.playMusic };
  };
  loadMetadata(originalMusic)
    .then((result) => {
      loadedMetadata = result;
      applyLoadedMetadata();
    })
    .catch((error) => {
      console.warn('[playbackController] Metadata loading failed:', error);
    });

  try {
    const playHistoryStore = await getPlayHistoryStore();
    playHistoryStore.addMusic(music);
  } catch (e) {
    console.warn('[playbackController] Failed to add playback history:', e);
  }

  try {
    const { getSongDetail } = useSongDetail();
    const updatedPlayMusic = await getSongDetail(originalMusic, requestId);

    if (gen !== generation) {
      console.log(
        `[playbackController] gen=${gen} Expired (after obtaining details), currently gen=${generation}`
      );
      return false;
    }

    playerCore.playMusic = updatedPlayMusic;
    playerCore.playMusicUrl = updatedPlayMusic.playMusicUrl as string;
    music.playMusicUrl = updatedPlayMusic.playMusicUrl as string;

    if (originalMusic.urlRejectedAt) {
      playerCore.playMusic.urlRejectedAt = originalMusic.urlRejectedAt;
    }

    applyLoadedMetadata();
  } catch (error) {
    if (gen !== generation) return false;
    console.error('[playbackController] Failed to get song details:', error);
    message.error('Play Failed, Play Next Song');
    if (playerCore.playMusic) {
      playerCore.playMusic.playLoading = false;
    }
    playbackRequestManager.failRequest(requestId);
    return false;
  }

  try {
    const success = await loadAndPlayAudio(playerCore.playMusic, shouldPlay);

    if (gen !== generation) {
      console.log(
        `[playbackController] gen=${gen} Expired (after playing audio), currently gen=${generation}`
      );
      audioService.stop();
      return false;
    }

    if (success) {
      resetUrlExpiredRetry();
      playerCore.playMusic.playLoading = false;
      playerCore.playMusic.isFirstPlay = false;
      playbackRequestManager.completeRequest(requestId);
      console.log(`[playbackController] gen=${gen} Played successfully: ${music.name}`);

      triggerPreload(playerCore.playMusic);

      return true;
    } else {
      playbackRequestManager.failRequest(requestId);
      return false;
    }
  } catch (error) {
    if (gen !== generation) {
      console.log(`[playbackController] gen=${gen} Expired (abnormal playback), return silently`);
      return false;
    }

    console.error('[playbackController] Failed to play audio:', error);

    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes('Operation lock activated')) {
      try {
        audioService.forceResetOperationLock();
        console.log('[playbackController] Action lock has been forcefully reset');
      } catch (e) {
        console.error('[playbackController] Failed to reset operation lock:', e);
      }
    }

    message.error('Play Failed, Play Next Song');
    if (playerCore.playMusic) {
      playerCore.playMusic.playLoading = false;
    }
    playerCore.setIsPlay(false);
    playbackRequestManager.failRequest(requestId);
    return false;
  }
};
const MAX_URL_EXPIRED_RETRIES = 1;
let urlExpiredRetrySongId: string | number | null = null;
let urlExpiredRetryCount = 0;

const resetUrlExpiredRetry = (): void => {
  urlExpiredRetrySongId = null;
  urlExpiredRetryCount = 0;
};


export const stopAll = async (): Promise<void> => {
  generation++;
  resetUrlExpiredRetry();

  audioService.stop();

  const playerCore = await getPlayerCoreStore();
  playerCore.setIsPlay(false);
  playerCore.userPlayIntent = false;
  playerCore.isFmPlaying = false;
  playerCore.playMusic = {} as SongResult;
  playerCore.playMusicUrl = '';

  try {
    const { nowTime, allTime, nowIndex } = await import('@/hooks/MusicHook');
    nowTime.value = 0;
    allTime.value = 0;
    nowIndex.value = 0;
  } catch (error) {
    console.error('[playbackController] Failed to reset the progress display:', error);
  }

  localStorage.removeItem('playProgress');
};

export const setupUrlExpiredHandler = (): void => {
  audioService.on('url_expired', async (expiredTrack: SongResult) => {
    if (!expiredTrack) return;

    console.log(
      '[playbackController] detectedURLExpired events, ready to be reacquiredURL',
      expiredTrack.name
    );

    const playerCore = await getPlayerCoreStore();

    if (!playerCore.userPlayIntent && !playerCore.play) {
      console.log(
        '[playbackController] The user has no intention to play and skipsURLExpiration processing'
      );
      return;
    }

    if (playerCore.playMusic?.id !== expiredTrack.id) {
      console.log(
        '[playbackController] The current song has been changed and skippedURLExpiration processing'
      );
      return;
    }

    if (urlExpiredRetrySongId === expiredTrack.id) {
      urlExpiredRetryCount++;
    } else {
      urlExpiredRetrySongId = expiredTrack.id;
      urlExpiredRetryCount = 1;
    }

    if (urlExpiredRetryCount > MAX_URL_EXPIRED_RETRIES) {
      console.warn(
        `[playbackController] ${expiredTrack.name} Recovery retry failed, switch to next song`
      );
      resetUrlExpiredRetry();
      try {
        const playlistStore = await getPlaylistStore();
        if (playlistStore.queueItems.length > 1 || playerCore.isFmPlaying) {
          playlistStore.nextPlay();
        } else {
          playerCore.setIsPlay(false);
        }
      } catch (error) {
        console.error('[playbackController] Failed to switch to next song:', error);
        playerCore.setIsPlay(false);
      }
      return;
    }

    let seekPosition = 0;
    try {
      seekPosition = await window.api.audioGetTime();
      const duration = audioService.getDuration();
      if (duration > 0 && seekPosition > 0 && duration - seekPosition < 5) {
        console.log(
          '[playbackController] The song is nearing the end, skipURLExpiration processing'
        );
        return;
      }
    } catch (error) {
      // No position yet (fresh source); recovering from 0 is still correct.
      console.warn('[playbackController] Could not read playback position', error);
    }

    try {
      const trackToPlay: SongResult = {
        ...expiredTrack,
        isFirstPlay: true,
        playMusicUrl: undefined,
        // Cleared alongside the URL: the container hint and the resolving client
        // both describe the URL that just failed, and the replacement may be a
        // different container from a different client.
        mimeType: undefined,
        streamUserAgent: undefined,
        // The replacement has not been tried yet, so this rejection marker has
        // to be dropped along with the URL it described. Leaving it set would
        // make the next lookup discard a URL it has never seen.
        urlRejectedAt: undefined
      };

      const success = await playTrack(trackToPlay, true);

      if (success && seekPosition > 0) {
        setTimeout(() => {
          try {
            audioService.seek(seekPosition);
          } catch {
            console.warn('[playbackController] Failed to restore playback position');
          }
        }, 300);
      }
    } catch (error) {
      console.error('[playbackController] deal withURLExpiration event failed:', error);
    }
  });
};

let lastYtmRequestKey: string | null = null;

/**
 * YouTube Music views (home / search / charts) queue a track and dispatch a
 * `ytm:play` window event instead of calling the player directly. This is the
 * single consumer that turns that event into real playback.
 */
export const setupYTMusicPlayHandler = (): void => {
  const handler = async (event: Event): Promise<void> => {
    const detail = (event as CustomEvent).detail as SongResult | undefined;

    if (!detail?.id || !detail?.name) {
      console.warn('[playbackController] ytm:play received a track without an id or name');
      return;
    }

    const requestKey = `${detail.source ?? 'ytmusic'}:${detail.id}`;

    // Guard against duplicate dispatches for the same track within a short window.
    if (lastYtmRequestKey === requestKey) return;
    lastYtmRequestKey = requestKey;
    setTimeout(() => {
      if (lastYtmRequestKey === requestKey) lastYtmRequestKey = null;
    }, 500);

    console.log(`[playbackController] ytm:play -> ${detail.name}`);

    try {
      await playTrack({ ...detail, playMusicUrl: undefined }, true);
    } catch (error) {
      console.error('[playbackController] Failed to start YouTube Music playback:', error);
      message.error('Play Failed, Play Next Song');
    }
  };

  window.addEventListener('ytm:play', handler as EventListener);
};

export const initializePlayState = async (): Promise<void> => {
  const playerCore = await getPlayerCoreStore();
  const settingsStore = await getSettingsStore();

  if (!playerCore.playMusic || Object.keys(playerCore.playMusic).length === 0) {
    console.log('[playbackController] No saved playback state, skipping initialization');

    setTimeout(() => {
      audioService.setPlaybackRate(playerCore.playbackRate);
    }, 2000);
    return;
  }

  try {
    console.log('[playbackController] Restore last played music:', playerCore.playMusic.name);
    const isPlaying = settingsStore.setData.autoPlay;

    if (!isPlaying) {
      console.log('[playbackController] Autoplay is disabled, only metadata is loaded');

      try {
        const { lyrics, backgroundColor, primaryColor } = await loadMetadata(playerCore.playMusic);
        playerCore.playMusic.lyric = lyrics;
        playerCore.playMusic.backgroundColor = backgroundColor;
        playerCore.playMusic.primaryColor = primaryColor;
      } catch (e) {
        console.warn('[playbackController] Loading metadata failed:', e);
      }

      playerCore.play = false;
      playerCore.isPlay = false;
      playerCore.userPlayIntent = false;

      updateDocumentTitle(playerCore.playMusic);

      try {
        const savedProgress = JSON.parse(localStorage.getItem('playProgress') || '{}');
        if (savedProgress.songId === playerCore.playMusic.id && savedProgress.progress > 0) {
          const { nowTime, allTime } = await import('@/hooks/MusicHook');
          nowTime.value = savedProgress.progress;

          if (playerCore.playMusic.dt) {
            allTime.value = playerCore.playMusic.dt / 1000;
          }
        }
      } catch (e) {
        console.warn('[playbackController] Failed to resume playback progress:', e);
      }
    } else {
      const isLocalMusic = playerCore.playMusic.playMusicUrl?.startsWith('local://');

      await playTrack(
        {
          ...playerCore.playMusic,
          isFirstPlay: true,
          playMusicUrl: isLocalMusic ? playerCore.playMusic.playMusicUrl : undefined
        },
        true
      );
    }
  } catch (error) {
    console.error('[playbackController] Failed to restore playback status:', error);
    playerCore.play = false;
    playerCore.isPlay = false;
    playerCore.playMusic = {} as SongResult;
    playerCore.playMusicUrl = '';
  }

  setTimeout(() => {
    audioService.setPlaybackRate(playerCore.playbackRate);
  }, 2000);
};
