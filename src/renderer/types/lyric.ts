export interface LyricConfig {
  hideCover: boolean;
  centerLyrics: boolean;
  fontSize: number;
  letterSpacing: number;
  fontWeight: number;
  lineHeight: number;
  showTranslation: boolean;
  theme: 'default' | 'light' | 'dark';
  hidePlayBar: boolean;
  translationEngine?: 'none' | 'opencc';
  pureModeEnabled: boolean;
  featherEdge: boolean;
  hideMiniPlayBar: boolean;
  hideLyrics: boolean;
  focusCurrentLyric: boolean;
  contentWidth: number;

  mobileLayout: 'default' | 'ios' | 'android';
  mobileCoverStyle: 'record' | 'square' | 'full';
  mobileShowLyricLines: number;

  useCustomBackground: boolean;
  backgroundMode: 'solid' | 'gradient' | 'image' | 'css';
  solidColor: string;
  gradientColors: {
    colors: string[];
    direction: string;
  };
  backgroundImage?: string;
  imageBlur: number;
  imageBrightness: number;
  customCss?: string;
}

export const DEFAULT_LYRIC_CONFIG: LyricConfig = {
  hideCover: false,
  centerLyrics: false,
  fontSize: 22,
  letterSpacing: 0,
  fontWeight: 500,
  lineHeight: 2,
  showTranslation: true,
  theme: 'default',
  hidePlayBar: true,
  hideMiniPlayBar: false,
  pureModeEnabled: false,
  featherEdge: true,
  hideLyrics: false,
  focusCurrentLyric: false,
  contentWidth: 75,

  mobileLayout: 'ios',
  mobileCoverStyle: 'full',
  mobileShowLyricLines: 3,

  translationEngine: 'none',

  useCustomBackground: false,
  backgroundMode: 'solid',
  solidColor: '#1a1a1a',
  gradientColors: {
    colors: ['#1a1a1a', '#000000'],
    direction: 'to bottom'
  },
  backgroundImage: undefined,
  imageBlur: 0,
  imageBrightness: 100,
  customCss: undefined
};

export interface ILyric {
  sgc: boolean;
  sfy: boolean;
  qfy: boolean;
  lrc: Lrc;
  klyric: Lrc;
  tlyric: Lrc;
  code: number;
}

interface Lrc {
  version: number;
  lyric: string;
}
