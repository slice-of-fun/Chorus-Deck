export interface YTMSong {
  id: string;
  title: string;
  artists: { name: string; id?: string }[];
  album?: string;
  duration?: string;
  thumbnail: string;
}

export interface YTMPlaylist {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail: string;
}

export interface YTMSection {
  title: string;
  items: (YTMSong | YTMPlaylist)[];
}

export interface YTMPlaylistDetail {
  id: string;
  title: string;
  description?: string;
  author?: string;
  thumbnail: string;
  songCount: number;
  songs: YTMSong[];
}

export interface YTMArtistDetail {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  subscriberCount?: string;
  songs: YTMSong[];
  albums: YTMPlaylist[];
  playlists: YTMPlaylist[];
}

export interface YTMHomePage {
  sections: YTMSection[];
}

export interface YTMChartsPage {
  sections: YTMSection[];
}

export interface YTMSearchResult {
  topResult?: YTMSong | YTMPlaylist;
  songs: YTMSong[];
  playlists: YTMPlaylist[];
  albums: YTMPlaylist[];
  artists: YTMPlaylist[];
  videos: YTMSong[];
  total: number;
}

export interface YTMSearchSuggestion {
  query: string;
  fromHistory: boolean;
}

export interface YTMMood {
  id: string;
  title: string;
  thumbnail: string;
}

export interface YTMStream {
  videoId: string;
  url: string;
  mimeType: string;
  bitrate: number;
  approxDurationMs: number;
  contentLength?: number;
  expiresInSeconds: number;
  title?: string;
  author?: string;
  thumbnail?: string;
  durationSeconds?: number;
  clientNameId: number;
  userAgent: string;
}

interface YTMStreamFailure {
  clientNameId: number;
  reason: string;
  status?: string;
}

export interface YTMStreamResult {
  success: boolean;
  data?: YTMStream;
  error?: string;
  attempts?: YTMStreamFailure[];
}

async function ytmPost(
  endpoint: string,
  body: object,
  cookie?: string,
  clientOverride?: {
    clientNameId: number;
    clientVersion: string;
    userAgent: string;
    context: any;
  }
): Promise<any> {
  if (typeof window === 'undefined' || !window.api) {
    throw new Error('IPC not available (Tauri bridge is not installed)');
  }

  const payload = { ...body };
  if (clientOverride?.context) {
    (payload as any).context = clientOverride.context;
  }

  try {
    const data = await window.api.invoke<any>('ytm:request', {
      args: {
        endpoint,
        body: payload,
        cookie,
        clientNameId: clientOverride?.clientNameId,
        clientVersion: clientOverride?.clientVersion,
        userAgent: clientOverride?.userAgent,
        host: 'music'
      }
    });
    return data;
  } catch (error: any) {
    throw new Error(`YTM API error: ${error?.message || error}`);
  }
}

export interface StreamUrlProbe {
  playable: boolean;
  status: number;
  reason?: string | null;
}

async function validateStreamUrl(
  url: string,
  userAgent?: string
): Promise<StreamUrlProbe> {
  if (typeof window === 'undefined' || !window.api) {
    return { playable: true, status: 0, reason: null };
  }

  try {
    return await window.api.invoke<StreamUrlProbe>('ytm:validate-stream', {
      args: { url, userAgent }
    });
  } catch (error: any) {
    console.warn('[ytmusic] stream URL probe failed, trusting the URL:', error);
    return { playable: true, status: 0, reason: null };
  }
}

function parseRuns(runs: any[]): string {
  if (!runs) return '';
  return runs.map((r: any) => r.text || '').join('');
}

function parseThumbnail(thumbnails: any[]): string {
  if (!thumbnails?.length) return '';
  return thumbnails[thumbnails.length - 1]?.url || '';
}

function squareThumbnail(url: string, size: number = 226): string {
  if (!url) return '';
  if (url.includes('lh3.googleusercontent.com') || url.includes('yt3.ggpht.com')) {
    if (url.includes('=w')) {
      return url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
    }
    const base = url.split('=')[0];
    return `${base}=w${size}-h${size}-p-l90-rj`;
  }
  if (url.includes('i.ytimg.com')) {
    if (/\/vi\/[^/]+\/(maxresdefault|hqdefault|mqdefault|sddefault|default)\./.test(url)) {
      return url
        .replace(/\/(maxresdefault|hqdefault|mqdefault|sddefault|default)\./, '/hqdefault.')
        .split('?')[0];
    }
    return url.split('?')[0];
  }

  return url;
}

function parseSongItem(renderer: any): YTMSong | null {
  try {
    const cols = renderer.flexColumns || [];
    const title = parseRuns(cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs);
    const subtitle = cols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];

    const isArtistItem = subtitle.some(
      (run: any) =>
        run.text === 'Artist' ||
        run.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
          ?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST_OVERVIEW'
    );
    if (isArtistItem) return null;

    const artists: { name: string; id?: string }[] = [];
    let album: string | undefined;
    let duration: string | undefined;

    subtitle.forEach((run: any, i: number) => {
      if (
        run.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
          ?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ARTIST' ||
        run.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
          ?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL'
      ) {
        artists.push({ name: run.text, id: run.navigationEndpoint?.browseEndpoint?.browseId });
      } else if (
        run.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
          ?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ALBUM'
      ) {
        album = run.text;
      } else if (!run.navigationEndpoint && run.text !== ' • ') {
        if (run.text?.match(/^\d+:\d+$/)) duration = run.text;
        else if (
          artists.length === 0 &&
          (i === 0 || i === 2) &&
          run.text &&
          run.text !== 'Video' &&
          run.text !== 'Song'
        ) {
          artists.push({ name: run.text });
        }
      }
    });

    const videoId =
      renderer.playlistItemData?.videoId ||
      renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
        ?.playNavigationEndpoint?.watchEndpoint?.videoId;

    const thumbnails =
      renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
      renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
      renderer.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails;

    if (!videoId || !title) return null;

    return {
      id: videoId,
      title,
      artists,
      album,
      duration,
      thumbnail: squareThumbnail(parseThumbnail(thumbnails))
    };
  } catch {
    return null;
  }
}

function parsePlaylistItem(renderer: any): YTMPlaylist | null {
  try {
    const title =
      parseRuns(renderer.title?.runs) ||
      parseRuns(renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs);

    const browseId =
      renderer.navigationEndpoint?.browseEndpoint?.browseId ||
      renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
        ?.playNavigationEndpoint?.watchPlaylistEndpoint?.playlistId;

    const thumbnails =
      renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
      renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
      renderer.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ||
      renderer.thumbnailRenderer?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ||
      renderer.thumbnail?.thumbnails ||
      renderer.thumbnail?.artistArtRef?.[0]?.thumbnails ||
      renderer.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.thumbnail
        ?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
      renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.thumbnail
        ?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
      renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.thumbnail
        ?.musicThumbnailRenderer?.thumbnail?.thumbnails;
    const subtitle =
      renderer.flexColumns
        ?.slice(1)
        .map((fc: any) => parseRuns(fc?.musicResponsiveListItemFlexColumnRenderer?.text?.runs))
        .filter(Boolean)
        .join(' • ') || '';

    if (!title) return null;

    return {
      id: browseId || '',
      title,
      subtitle,
      thumbnail: squareThumbnail(parseThumbnail(thumbnails || []))
    };
  } catch {
    return null;
  }
}

function parseMusicShelfSection(shelf: any): YTMSection {
  const title = parseRuns(shelf.title?.runs) || shelf.title?.simpleText || '';
  const items: (YTMSong | YTMPlaylist)[] = [];

  (shelf.contents || []).forEach((c: any) => {
    const renderer = c.musicResponsiveListItemRenderer || c.musicTwoRowItemRenderer;

    if (!renderer) return;

    const song = parseSongItem(renderer);
    if (song) {
      items.push(song);
      return;
    }

    const playlist = parsePlaylistItem(renderer);
    if (playlist) items.push(playlist);
  });

  return { title, items };
}

const BROWSE_ID_PREFIXES = {
  playlist: 'VL',
  album: 'OLAK5uy_',
  channel: 'UC',
  autoPlaylist: 'RDAMVM'
};

function normalizeBrowseId(id: string, kind: keyof typeof BROWSE_ID_PREFIXES): string {
  if (!id) return '';
  if (id.startsWith('VL')) return id;
  if (id.startsWith('OLAK5uy_')) return id;
  if (id.startsWith('UC')) return id;
  return `${BROWSE_ID_PREFIXES[kind]}${id}`;
}

function collectShelves(data: any): any[] {
  const shelves: any[] = [];

  const walk = (node: any, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 12) return;

    if (Array.isArray(node)) {
      node.forEach((n) => walk(n, depth + 1));
      return;
    }

    if (node.musicShelfRenderer) shelves.push(node.musicShelfRenderer);
    if (node.musicCarouselShelfRenderer) shelves.push(node.musicCarouselShelfRenderer);

    for (const key of Object.keys(node)) {
      if (key === 'continuations' || key === 'continuationItems' || key === 'continuation')
        continue;
      const value = node[key];
      if (value && typeof value === 'object') walk(value, depth + 1);
    }
  };

  walk(data);
  return shelves;
}

function collectSongsFromShelves(shelves: any[]): YTMSong[] {
  const songs: YTMSong[] = [];
  const seen = new Set<string>();

  for (const shelf of shelves) {
    for (const c of shelf.contents || []) {
      const renderer = c.musicResponsiveListItemRenderer || c.musicTwoRowItemRenderer;
      if (!renderer) continue;
      const song = parseSongItem(renderer);
      if (song && !seen.has(song.id)) {
        seen.add(song.id);
        songs.push(song);
      }
    }
  }

  return songs;
}

function parseHeader(data: any) {
  const header =
    data?.header?.musicDetailHeaderRenderer ||
    data?.header?.musicVisualHeaderRenderer ||
    data?.header?.musicImmersiveHeaderRenderer ||
    data?.header?.musicEditablePlaylistDetailHeaderRenderer;

  const title =
    parseRuns(header?.title?.runs) ||
    header?.title?.simpleText ||
    parseRuns(header?.straplineTextOne?.runs) ||
    '';

  const thumbnail =
    parseThumbnail(
      header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
        header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ||
        header?.thumbnailRenderer?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ||
        header?.backgroundImage?.sources ||
        []
    ) || '';

  const description =
    parseRuns(header?.description?.runs) ||
    header?.description?.simpleText ||
    parseRuns(header?.secondSubtitle?.runs) ||
    undefined;

  let author: string | undefined;
  let subscriberCount: string | undefined;

  for (const run of header?.straplineTextTwo?.runs || []) {
    const pageType =
      run.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
        ?.browseEndpointContextMusicConfig?.pageType;
    if (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || pageType === 'MUSIC_PAGE_TYPE_USER_CHANNEL') {
      author = run.text;
    } else if (/\d/.test(run.text) && /(subscriber|subscribers)/i.test(run.text)) {
      subscriberCount = run.text;
    }
  }

  if (!author) {
    author = parseRuns(header?.straplineTextOne?.runs) || undefined;
  }

  const songCountRaw =
    header?.secondSubtitle?.runs?.[0]?.text || header?.straplineTextOne?.runs?.[0]?.text || '';
  const songCount = Number((songCountRaw.match(/[\d,]+/)?.[0] || '0').replace(/,/g, ''));

  return { title, thumbnail, description, author, subscriberCount, songCount };
}

export async function getYTMHome(cookie?: string): Promise<YTMHomePage> {
  const data = await ytmPost('browse', { browseId: 'FEmusic_home' }, cookie);

  const sections: YTMSection[] = [];
  const contents =
    data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents || [];

  for (const content of contents) {
    const shelf =
      content.musicImmersiveCarouselShelfRenderer ||
      content.musicCarouselShelfRenderer ||
      content.musicShelfRenderer ||
      content.musicImmersiveHeaderRenderer;

    if (!shelf) continue;

    const title =
      parseRuns(shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs) ||
      parseRuns(shelf.header?.musicImmersiveCarouselShelfBasicHeaderRenderer?.title?.runs) ||
      parseRuns(shelf.title?.runs) ||
      '';

    const items: (YTMSong | YTMPlaylist)[] = [];

    (shelf.contents || []).forEach((c: any) => {
      const renderer = c.musicTwoRowItemRenderer || c.musicResponsiveListItemRenderer;
      if (!renderer) return;

      const song = parseSongItem(renderer);
      if (song) {
        items.push(song);
        return;
      }

      const playlist = parsePlaylistItem(renderer);
      if (playlist) items.push(playlist);
    });

    if (items.length > 0) {
      sections.push({ title: title || 'Recommended', items });
    }
  }

  return { sections };
}

export async function getYTMCharts(cookie?: string): Promise<YTMChartsPage> {
  const data = await ytmPost('browse', { browseId: 'FEmusic_charts' }, cookie);

  const sections: YTMSection[] = [];
  const contents =
    data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents || [];

  for (const content of contents) {
    const shelf = content.musicShelfRenderer || content.musicCarouselShelfRenderer;
    if (!shelf) continue;
    sections.push(parseMusicShelfSection(shelf));
  }

  return { sections };
}

export async function searchYTM(
  query: string,
  filter?: 'songs' | 'videos' | 'albums' | 'artists' | 'playlists',
  cookie?: string
): Promise<YTMSearchResult> {
  const body: any = { query };

  const filterMap: Record<string, string> = {
    songs: 'EgWKAQIIAWoKEAkQAxAEEAoQBQ==',
    videos: 'EgWKAQIQAWoKEAkQAxAEEAoQBQ==',
    albums: 'EgWKAQIYAWoKEAkQAxAEEAoQBQ==',
    artists: 'EgWKAQIgAWoKEAkQAxAEEAoQBQ==',
    playlists: 'Eg-KAQwIABAAGAAgACgBMABqChAJEAMQBBAKEAU='
  };

  if (filter && filterMap[filter]) {
    body.params = filterMap[filter];
  }

  const data = await ytmPost('search', body, cookie);

  let topResult: YTMSong | YTMPlaylist | undefined;
  const songs: YTMSong[] = [];
  const playlists: YTMPlaylist[] = [];
  const albums: YTMPlaylist[] = [];
  const artists: YTMPlaylist[] = [];
  const videos: YTMSong[] = [];

  const contents: any[] =
    data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
      ?.contents ||
    data.contents?.sectionListRenderer?.contents ||
    [];

  for (const content of contents) {
    if (content.musicCardShelfRenderer && !topResult) {
      const r = content.musicCardShelfRenderer;
      const title = parseRuns(r.title?.runs);
      const thumbnails = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
      const browseId =
        r.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
        r.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
        '';

      let subtitle = parseRuns(r.subtitle?.runs);
      const isSongCard = subtitle?.includes('Song');
      const isArtistCard = subtitle?.includes('Artist');
      const isVideoCard = subtitle?.includes('Video');
      const isAlbumCard =
        subtitle?.includes('Album') || subtitle?.includes('Single') || subtitle?.includes('EP');

      let resultType = 'Top Result';
      if (isSongCard) resultType = 'Song';
      else if (isVideoCard) resultType = 'Video';
      else if (isArtistCard) resultType = 'Artist';
      else if (isAlbumCard) resultType = 'Album';

      if (subtitle) {
        const parts = subtitle.split(' • ');
        subtitle = parts
          .filter((part: string) => {
            const lower = part.trim().toLowerCase();
            if (
              lower === 'video' ||
              lower === 'song' ||
              lower === 'artist' ||
              lower === 'album' ||
              lower === 'single' ||
              lower === 'ep'
            )
              return false;
            if (lower.includes('views') || lower.includes('plays')) return false;
            return true;
          })
          .join(' • ');
      }

      if (title && (isSongCard || isArtistCard || isVideoCard)) {
        topResult = {
          id: browseId,
          title,
          subtitle,
          thumbnail: squareThumbnail(parseThumbnail(thumbnails || [])),
          resultType
        } as any;
      }
    }

    const shelf = content.musicShelfRenderer || content.musicCardShelfRenderer;
    let shelfContents = shelf?.contents || [];

    if (!shelf && content.itemSectionRenderer) {
      shelfContents = content.itemSectionRenderer.contents || [];
    }

    if (!shelfContents.length) continue;

    for (const c of shelfContents) {
      const renderer = c.musicResponsiveListItemRenderer || c.musicTwoRowItemRenderer;
      if (!renderer) continue;

      const song = parseSongItem(renderer);
      if (song) {
        const ep =
          renderer.navigationEndpoint ||
          renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
            ?.playNavigationEndpoint;
        const videoType =
          ep?.watchEndpoint?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig
            ?.musicVideoType;
        const firstRun =
          renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
            ?.text;
        const allRunsText = (
          renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || []
        )
          .map((r: any) => r.text)
          .join('');

        const isVideoType =
          videoType?.includes('MUSIC_VIDEO_TYPE_UGC') ||
          videoType?.includes('MUSIC_VIDEO_TYPE_OMV') ||
          firstRun === 'Video';
        const isSongType =
          videoType?.includes('MUSIC_VIDEO_TYPE_ATV') ||
          firstRun === 'Song' ||
          firstRun === 'Audio';

        if (filter === 'videos') {
          videos.push(song);
        } else if (filter === 'songs') {
          songs.push(song);
        } else {
          if (isVideoType) {
            videos.push(song);
          } else if (isSongType) {
            songs.push(song);
          } else {
            if (allRunsText.includes('Video') || !song.album) {
              videos.push(song);
            } else {
              songs.push(song);
            }
          }
        }
        continue;
      }

      const playlist = parsePlaylistItem(renderer);
      if (playlist) {
        if (
          filter === 'albums' ||
          playlist.subtitle?.includes('Album') ||
          playlist.subtitle?.includes('EP') ||
          playlist.subtitle?.includes('Single')
        )
          albums.push(playlist);
        else if (
          filter === 'artists' ||
          playlist.subtitle?.includes('Artist') ||
          playlist.subtitle?.includes('artist')
        )
          artists.push(playlist);
        else playlists.push(playlist);
      }
    }
  }

  if (!topResult) {
    if (songs.length > 0) {
      const firstSong = songs[0];
      topResult = {
        id: firstSong.id,
        title: firstSong.title,
        subtitle: firstSong.artists.map((a: any) => a.name).join(', '),
        thumbnail: firstSong.thumbnail,
        artists: firstSong.artists,
        album: firstSong.album,
        resultType: 'Song'
      } as any;
    } else if (videos.length > 0) {
      const firstVideo = videos[0];
      topResult = {
        id: firstVideo.id,
        title: firstVideo.title,
        subtitle: firstVideo.artists.map((a: any) => a.name).join(', '),
        thumbnail: firstVideo.thumbnail,
        artists: firstVideo.artists,
        album: firstVideo.album,
        resultType: 'Video'
      } as any;
    }
  }

  return {
    topResult,
    songs,
    playlists,
    albums,
    artists,
    videos,
    total: songs.length + playlists.length + albums.length + artists.length + videos.length
  };
}

export async function getYTMSuggestions(
  query: string,
  cookie?: string
): Promise<YTMSearchSuggestion[]> {
  try {
    const data = await ytmPost('music/get_search_suggestions', { input: query }, cookie);
    const contents = data?.contents?.[0]?.searchSuggestionsSectionRenderer?.contents || [];

    return contents
      .map((c: any) => {
        const runs = c.searchSuggestionRenderer?.suggestion?.runs || [];
        return {
          query: parseRuns(runs),
          fromHistory: false
        };
      })
      .filter((s: YTMSearchSuggestion) => !!s.query);
  } catch (err) {
    console.warn('Failed to get YTM suggestions via API endpoint', err);
    return [];
  }
}

export async function getYTMMoods(cookie?: string): Promise<YTMMood[]> {
  const data = await ytmPost('browse', { browseId: 'FEmusic_moods_and_genres' }, cookie);

  const moods: YTMMood[] = [];
  const contents =
    data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents || [];

  for (const content of contents) {
    const shelf = content.gridRenderer || content.musicCarouselShelfRenderer;
    if (!shelf) continue;

    (shelf.items || shelf.contents || []).forEach((c: any) => {
      const r = c.musicNavigationButtonRenderer;
      if (!r) return;
      const id = r.clickCommand?.browseEndpoint?.browseId || '';
      const title = parseRuns(r.buttonText?.runs) || r.buttonText?.simpleText || '';
      const thumbnail = '';
      if (title) moods.push({ id, title, thumbnail });
    });
  }

  return moods;
}

export interface YTStreamClient {
  clientName: string;
  clientVersion: string;
  clientId: number;
  userAgent: string;
  osName?: string;
  osVersion?: string;
  deviceMake?: string;
  deviceModel?: string;
  androidSdkVersion?: number;
  buildId?: string;
  cronetVersion?: string;
  packageName?: string;
  friendlyName?: string;
  loginSupported: boolean;
  loginRequired: boolean;
  useSignatureTimestamp: boolean;
  useWebPoTokens: boolean;
  isEmbedded: boolean;
}

const USER_AGENT_WEB =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';

const WEB_REMIX: YTStreamClient = {
  clientName: 'WEB_REMIX',
  clientVersion: '1.20260213.01.00',
  clientId: 67,
  userAgent: USER_AGENT_WEB,
  loginSupported: true,
  loginRequired: false,
  useSignatureTimestamp: true,
  useWebPoTokens: true,
  isEmbedded: false
};

const STREAM_FALLBACK_CLIENTS: YTStreamClient[] = [
  {
    clientName: 'VISIONOS',
    clientVersion: '0.1',
    clientId: 101,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    osName: 'visionOS',
    osVersion: '1.3.21O771',
    deviceMake: 'Apple',
    deviceModel: 'RealityDevice14,1',
    friendlyName: 'visionOS',
    loginSupported: false,
    loginRequired: false,
    useSignatureTimestamp: false,
    useWebPoTokens: false,
    isEmbedded: false
  },
  {
    clientName: 'ANDROID_VR',
    clientVersion: '1.65.10',
    clientId: 28,
    userAgent:
      'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    osName: 'Android',
    osVersion: '12L',
    deviceMake: 'Oculus',
    deviceModel: 'Quest 3',
    androidSdkVersion: 32,
    friendlyName: 'Android VR 1.65',
    loginSupported: false,
    loginRequired: false,
    useSignatureTimestamp: false,
    useWebPoTokens: false,
    isEmbedded: false
  },
  {
    clientName: 'TVHTML5',
    clientVersion: '7.20260213.00.00',
    clientId: 7,
    userAgent:
      'Mozilla/5.0(SMART-TV; Linux; Tizen 4.0.0.2) AppleWebkit/605.1.15 (KHTML, like Gecko) SamsungBrowser/9.2 TV Safari/605.1.15',
    loginSupported: true,
    loginRequired: true,
    useSignatureTimestamp: true,
    useWebPoTokens: true,
    isEmbedded: false
  },
  {
    clientName: 'ANDROID_VR',
    clientVersion: '1.43.32',
    clientId: 28,
    userAgent:
      'com.google.android.apps.youtube.vr.oculus/1.43.32 (Linux; U; Android 12; en_US; Quest 3; Build/SQ3A.220605.009.A1; Cronet/107.0.5284.2)',
    osName: 'Android',
    osVersion: '12',
    deviceMake: 'Oculus',
    deviceModel: 'Quest 3',
    androidSdkVersion: 32,
    buildId: 'SQ3A.220605.009.A1',
    cronetVersion: '107.0.5284.2',
    packageName: 'com.google.android.apps.youtube.vr.oculus',
    friendlyName: 'Android VR 1.43',
    loginSupported: false,
    loginRequired: false,
    useSignatureTimestamp: false,
    useWebPoTokens: false,
    isEmbedded: false
  },
  {
    clientName: 'IOS',
    clientVersion: '21.03.3',
    clientId: 5,
    userAgent:
      'com.google.ios.youtube/21.03.3 (iPad7,6; U; CPU iPadOS 17_7_10 like Mac OS X; en-US)',
    osName: 'iPadOS',
    osVersion: '17.7.10.21H450',
    deviceMake: 'Apple',
    deviceModel: 'iPad7,6',
    friendlyName: 'iPadOS',
    packageName: 'com.google.ios.youtube',
    loginSupported: false,
    loginRequired: false,
    useSignatureTimestamp: false,
    useWebPoTokens: false,
    isEmbedded: false
  },
  {
    clientName: 'IOS',
    clientVersion: '21.03.1',
    clientId: 5,
    userAgent:
      'com.google.ios.youtube/21.03.1 (iPhone16,2; U; CPU iOS 18_2 like Mac OS X;)',
    osVersion: '18.2.22C152',
    friendlyName: 'iPhone',
    loginSupported: false,
    loginRequired: false,
    useSignatureTimestamp: false,
    useWebPoTokens: false,
    isEmbedded: false
  },
  {
    clientName: 'WEB_CREATOR',
    clientVersion: '1.20260213.00.00',
    clientId: 62,
    userAgent: USER_AGENT_WEB,
    loginSupported: true,
    loginRequired: true,
    useSignatureTimestamp: true,
    useWebPoTokens: true,
    isEmbedded: false
  }
];

const PRIVATE_TRACK_STREAM_START_INDEX =
  STREAM_FALLBACK_CLIENTS.findIndex((c) => c.clientName === 'TVHTML5');

const clientContext = (client: YTStreamClient) => {
  const context: Record<string, unknown> = {
    clientName: client.clientName,
    clientVersion: client.clientVersion,
    hl: 'en',
    gl: 'US',
    osName: client.osName,
    osVersion: client.osVersion,
    deviceMake: client.deviceMake,
    deviceModel: client.deviceModel,
    androidSdkVersion: client.androidSdkVersion,
    buildId: client.buildId,
    cronetVersion: client.cronetVersion,
    packageName: client.packageName
  };

  for (const key of Object.keys(context)) {
    if (context[key] === undefined) delete context[key];
  }

  return { client: context, user: {} };
};

const pickBestAudioFormat = (adaptiveFormats: any[]): any | null => {
  if (!Array.isArray(adaptiveFormats) || adaptiveFormats.length === 0) return null;

  const audioOnly = adaptiveFormats.filter(
    (f) => f?.width == null && f?.audioTrack?.isAutoDubbed == null
  );

  if (audioOnly.length === 0) return null;

  const mp4 = audioOnly.filter((f) => f?.mimeType?.startsWith('audio/mp4'));
  if (mp4.length === 0) {
    return null;
  }

  return mp4.reduce((best, current) => {
    const bestBitrate = best?.averageBitrate ?? best?.bitrate ?? 0;
    const currentBitrate = current?.averageBitrate ?? current?.bitrate ?? 0;
    return currentBitrate > bestBitrate ? current : best;
  }, mp4[0]);
};

interface StreamAttempt {
  clientName: string;
  clientId: number;
  outcome: string;
  reason?: string;
  status?: string;
}

export async function getYTMStream(videoId: string, cookie?: string): Promise<YTMStream | null> {
  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) {
    throw new Error('Invalid YouTube video id');
  }

  const isLoggedIn = Boolean(cookie);
  const attempts: StreamAttempt[] = [];

  let sawPrivateTrack = false;

  const skipMainClient = WEB_REMIX.useWebPoTokens;
  if (skipMainClient) {
    attempts.push({
      clientName: WEB_REMIX.clientName,
      clientId: WEB_REMIX.clientId,
      outcome: 'SKIP',
      reason: 'poTokenUnavailable'
    });
  }

  const tryClient = async (client: YTStreamClient): Promise<YTMStream | null> => {
    const data = await ytmPost(
      'player',
      {
        videoId,
        contentCheckOk: true,
        racyCheckOk: true
      },
      cookie,
      {
        clientNameId: client.clientId,
        clientVersion: client.clientVersion,
        userAgent: client.userAgent,
        context: clientContext(client)
      }
    );

    const status = data?.playabilityStatus?.status;

    if (data?.videoDetails?.musicVideoType === 'MUSIC_VIDEO_TYPE_OMNI') {
      sawPrivateTrack = true;
    }

    if (status && status !== 'OK') {
      attempts.push({
        clientName: client.clientName,
        clientId: client.clientId,
        outcome: 'STATUS',
        status,
        reason:
          data?.playabilityStatus?.reason ??
          data?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText ??
          'Playback not permitted'
      });
      return null;
    }

    const format = pickBestAudioFormat(data?.streamingData?.adaptiveFormats ?? []);

    if (!format) {
      attempts.push({
        clientName: client.clientName,
        clientId: client.clientId,
        outcome: 'NO_FORMAT',
        status,
        reason: 'No audio-only original format in player response'
      });
      return null;
    }

    const url = typeof format.url === 'string' && format.url.startsWith('http') ? format.url : '';
    if (!url) {
      const ciphered = Boolean(format.signatureCipher || format.cipher);
      attempts.push({
        clientName: client.clientName,
        clientId: client.clientId,
        outcome: 'NO_URL',
        status,
        reason: ciphered
          ? 'Format returned signatureCipher only (no deciphering available)'
          : 'Format carried no URL'
      });
      return null;
    }

    return {
      videoId,
      url,
      mimeType: format.mimeType,
      bitrate: format.averageBitrate ?? format.bitrate ?? 0,
      approxDurationMs: Number(format.approxDurationMs) || 0,
      contentLength: Number(format.contentLength) || undefined,
      expiresInSeconds: data?.streamingData?.expiresInSeconds ?? 21600,
      title: data?.videoDetails?.title,
      author: data?.videoDetails?.author,
      thumbnail:
        data?.videoDetails?.thumbnail?.thumbnails?.slice(-1)[0]?.url ??
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      durationSeconds: data?.videoDetails?.lengthSeconds
        ? Number(data.videoDetails.lengthSeconds)
        : undefined,
      clientNameId: client.clientId,
      userAgent: client.userAgent
    };
  };

  const runCascade = async (startIndex: number): Promise<YTMStream | null> => {
    for (let i = startIndex; i < STREAM_FALLBACK_CLIENTS.length; i++) {
      const client = STREAM_FALLBACK_CLIENTS[i];

      if (client.loginRequired && !isLoggedIn) {
        attempts.push({
          clientName: client.clientName,
          clientId: client.clientId,
          outcome: 'SKIP',
          reason: 'loginRequiredButAnonymous'
        });
        continue;
      }

      try {
        const stream = await tryClient(client);
        if (!stream) continue;
        const probe = await validateStreamUrl(stream.url, client.userAgent);

        if (!probe.playable) {
          attempts.push({
            clientName: client.clientName,
            clientId: client.clientId,
            outcome: 'CDN_REJECTED',
            status: 'OK',
            reason: `Resolved URL was refused on download (HTTP ${probe.status})${
              probe.reason ? `: ${probe.reason}` : ''
            }`
          });
          continue;
        }

        return stream;
      } catch (e: any) {
        attempts.push({
          clientName: client.clientName,
          clientId: client.clientId,
          outcome: 'ERROR',
          reason: e?.message ?? String(e)
        });
      }
    }
    return null;
  };

  const stream = await runCascade(0);

  if (stream) {
    return stream;
  }

  if (sawPrivateTrack && PRIVATE_TRACK_STREAM_START_INDEX >= 0) {
    const retry = await runCascade(PRIVATE_TRACK_STREAM_START_INDEX);
    if (retry) return retry;
  }

  console.warn('[YTM stream] cascade exhausted:', attempts);

  const isLoginRequired = attempts.some((a) => a.status === 'LOGIN_REQUIRED');
  if (isLoginRequired) {
    throw new Error('YouTube Music sign-in is required for this track');
  }

  throw new Error(`Unable to resolve a YouTube stream. Attempts: ${JSON.stringify(attempts)}`);
}

export async function getYTMPlaylist(
  playlistId: string,
  cookie?: string
): Promise<YTMPlaylistDetail> {
  const browseId = normalizeBrowseId(playlistId, 'playlist');
  if (!browseId) throw new Error('Invalid playlist id');

  const data = await ytmPost('browse', { browseId }, cookie);
  const header = parseHeader(data);
  const shelves = collectShelves(data);
  const songs = collectSongsFromShelves(shelves);

  return {
    id: playlistId,
    title: header.title || 'Playlist',
    description: header.description,
    author: header.author,
    thumbnail: header.thumbnail || `https://i.ytimg.com/vi/${playlistId}/hqdefault.jpg`,
    songCount: header.songCount || songs.length,
    songs
  };
}

export async function getYTMArtist(artistId: string, cookie?: string): Promise<YTMArtistDetail> {
  const browseId = normalizeBrowseId(artistId, 'channel');
  if (!browseId) throw new Error('Invalid artist id');

  const data = await ytmPost('browse', { browseId }, cookie);
  const header = parseHeader(data);
  const shelves = collectShelves(data);
  const songs = collectSongsFromShelves(shelves);

  const albums: YTMPlaylist[] = [];
  const playlists: YTMPlaylist[] = [];

  for (const shelf of shelves) {
    for (const c of shelf.contents || []) {
      const renderer = c.musicTwoRowItemRenderer;
      if (!renderer) continue;
      const item = parsePlaylistItem(renderer);
      if (!item?.id) continue;

      const pageType =
        renderer.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
          ?.browseEndpointContextMusicConfig?.pageType;

      if (pageType === 'MUSIC_PAGE_TYPE_ALBUM') albums.push(item);
      else playlists.push(item);
    }
  }

  return {
    id: artistId,
    title: header.title || 'Artist',
    description: header.description,
    thumbnail: header.thumbnail,
    subscriberCount: header.subscriberCount,
    songs,
    albums,
    playlists
  };
}

export const getYTMPlaylistDetail = getYTMPlaylist;

export function isYTMSong(item: YTMSong | YTMPlaylist): item is YTMSong {
  return 'artists' in item;
}
