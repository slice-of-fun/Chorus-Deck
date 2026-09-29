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
  clientOverride?: { clientNameId: number; context: any; userAgent: string }
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
      endpoint,
      body: payload,
      cookie,
      clientNameId: clientOverride?.clientNameId,
      clientVersion: clientOverride?.context?.client?.clientVersion
    });
    return data;
  } catch (error: any) {
    throw new Error(`YTM API error: ${error?.message || error}`);
  }
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

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

const pickBestAudioFormat = (formats: any[]): any | null => {
  if (!Array.isArray(formats) || formats.length === 0) return null;

  const audioOnly = formats.filter(
    (f) =>
      f?.mimeType?.startsWith('audio/') &&
      typeof f.url === 'string' &&
      f.url.length > 0 &&
      f.url.startsWith('http')
  );

  const candidates = audioOnly.length > 0 ? audioOnly : [];

  if (candidates.length === 0) return null;

  return candidates.reduce((best, current) => {
    const bestBitrate = best?.averageBitrate ?? best?.bitrate ?? 0;
    const currentBitrate = current?.averageBitrate ?? current?.bitrate ?? 0;
    return currentBitrate > bestBitrate ? current : best;
  }, candidates[0]);
};

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

const STREAM_CLIENTS = [
  {
    clientNameId: 28,
    context: {
      client: {
        clientName: 'ANDROID_VR',
        clientVersion: '1.60.19',
        deviceModel: 'Quest 3',
        androidSdkVersion: 32,
        osName: 'Android',
        osVersion: '12',
        hl: 'en',
        gl: 'US',
        timeZone: 'UTC',
        utcOffsetMinutes: 0
      }
    },
    userAgent:
      'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12; eureka-user Build/SQ3A.220605.009.A1) gzip'
  },
  {
    clientNameId: 5,
    context: {
      client: {
        clientName: 'IOS',
        clientVersion: '19.29.1',
        deviceModel: 'iPhone16,2',
        hl: 'en',
        gl: 'US',
        timeZone: 'UTC',
        utcOffsetMinutes: 0
      }
    },
    userAgent: 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X)'
  },
  {
    clientNameId: 85,
    context: {
      client: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'en',
        gl: 'US'
      }
    },
    userAgent:
      'Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15'
  }
];

export async function getYTMStream(videoId: string, cookie?: string): Promise<YTMStream | null> {
  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) {
    throw new Error('Invalid YouTube video id');
  }

  const attempts: YTMStreamFailure[] = [];

  for (const client of STREAM_CLIENTS) {
    try {
      const data = await ytmPost(
        'player',
        {
          videoId,
          contentCheckOk: true,
          racyCheckOk: true
        },
        cookie,
        client
      );

      const status = data?.playabilityStatus?.status;

      if (status && status !== 'OK') {
        attempts.push({
          clientNameId: client.clientNameId,
          reason:
            data?.playabilityStatus?.reason ??
            data?.playabilityStatus?.errorScreen?.playerErrorMessageRenderer?.reason?.simpleText ??
            'Playback not permitted',
          status
        });
        continue;
      }

      const formats = [
        ...(data?.streamingData?.adaptiveFormats ?? []),
        ...(data?.streamingData?.formats ?? [])
      ];

      const format = pickBestAudioFormat(formats);

      if (!format) {
        attempts.push({
          clientNameId: client.clientNameId,
          reason: 'No audio stream available in player response',
          status
        });
        continue;
      }

      return {
        videoId,
        url: format.url,
        mimeType: format.mimeType,
        bitrate: format.averageBitrate ?? format.bitrate ?? 0,
        approxDurationMs: format.approxDurationMs ?? 0,
        contentLength: Number(format.contentLength) || undefined,
        expiresInSeconds: format.expiresInSeconds ?? 21600,
        title: data?.videoDetails?.title,
        author: data?.videoDetails?.author,
        thumbnail:
          data?.videoDetails?.thumbnail?.thumbnails?.slice(-1)[0]?.url ??
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        durationSeconds: data?.videoDetails?.lengthSeconds
          ? Number(data.videoDetails.lengthSeconds)
          : undefined,
        clientNameId: client.clientNameId
      };
    } catch (e: any) {
      attempts.push({
        clientNameId: client.clientNameId,
        reason: e?.message ?? String(e)
      });
    }
  }

  const isLoginRequired = attempts.some((a) => a.status === 'LOGIN_REQUIRED');
  if (isLoginRequired) {
    throw new Error('YouTube Music sign-in is required for this track');
  } else {
    throw new Error(`Unable to resolve a YouTube stream. Attempts: ${JSON.stringify(attempts)}`);
  }
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

// ─── Type Guards ─────────────────────────────────────────────────────────────

export function isYTMSong(item: YTMSong | YTMPlaylist): item is YTMSong {
  return 'artists' in item;
}
