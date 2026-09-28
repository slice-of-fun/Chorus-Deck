export const SUPPORTED_AUDIO_FORMATS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'] as const;

export type SupportedAudioFormat = (typeof SUPPORTED_AUDIO_FORMATS)[number];

export type LocalMusicMeta = {
  filePath: string;

  title: string;

  artist: string;

  album: string;

  duration: number;

  coverPath: string | null;

  lyrics: string | null;

  fileSize: number;

  modifiedTime: number;
};

export type LocalMusicEntry = LocalMusicMeta & {
  id: string;
};
