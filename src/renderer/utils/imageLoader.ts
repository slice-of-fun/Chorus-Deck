const MAX_ENTRIES = 150;
const MAX_COOLDOWN_MS = 5 * 60 * 1000;
const BASE_COOLDOWN_MS = 10 * 1000;

const inFlight = new Map<string, Promise<HTMLImageElement>>();
const loaded = new Map<string, HTMLImageElement>();
const failures = new Map<string, { count: number; until: number }>();

const SIZE_PARAMS = new Set(['param', 'thumbnail', 'w', 'h', 'sz', 's', 'rs', 'quality']);
const stripSizeFromUrl = (url: string): string =>
  url
    .replace(/\/(?:sd|s|w)\d+(?:-h\d+)?(?=[-/.]|$)/gi, '/')
    .replace(/\/-(?=[a-z])/gi, '/')
    .replace(/\/(?:sd|s|w)\d+(?:-h\d+)?$/gi, '/')
    .replace(/=(?:sd|s|w)\d+(?:-h\d+)?(?=-c|-l0|-no|$)/gi, '')
    .replace(/[/-]l0(?:-n)?(?:\.[a-z0-9]+)?$/i, '')
    .replace(/\/+$/, '');

const evictOldest = <T>(map: Map<string, T>) => {
  while (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next();
    if (oldest.done) return;
    map.delete(oldest.value);
  }
};

export const artworkIdentity = (url: string): string => {
  if (!url) return '';

  const [rawPath = '', rawQuery] = stripSizeFromUrl(url).split('?');

  const params = rawQuery
    ?.split('&')
    .filter((pair) => {
      const key = pair.split('=')[0]?.toLowerCase();
      return key !== undefined && !SIZE_PARAMS.has(key);
    })
    .join('&');

  return params ? `${rawPath}?${params}` : rawPath;
};

const cooldownFor = (identity: string, now: number): number => {
  const record = failures.get(identity);
  if (!record || record.until <= now) return 0;
  return record.until;
};

const recordFailure = (identity: string) => {
  const record = failures.get(identity);
  const count = (record?.count ?? 0) + 1;
  const delay = Math.min(BASE_COOLDOWN_MS * 2 ** (count - 1), MAX_COOLDOWN_MS);
  failures.set(identity, { count, until: Date.now() + delay });
  evictOldest(failures);
  return delay;
};

const startLoad = (url: string): Promise<HTMLImageElement> => {
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
      const identity = artworkIdentity(url);
      failures.delete(identity);
      loaded.set(url, img);
      evictOldest(loaded);
      resolve(img);
    };

    img.onerror = () => {
      const delay = recordFailure(artworkIdentity(url));
      reject(new Error(`Image failed to load (cooling down ${Math.round(delay / 1000)}s)`));
    };

    img.src = url;
  });
  promise.catch(() => undefined);

  return promise;
};

export const loadImageOnce = (url: string): Promise<HTMLImageElement> => {
  if (!url) return Promise.reject(new Error('No image URL'));

  const cached = loaded.get(url);
  if (cached) return Promise.resolve(cached);

  const identity = artworkIdentity(url);
  const now = Date.now();
  const remaining = cooldownFor(identity, now);
  if (remaining > 0) {
    return Promise.reject(
      new Error(`Image cooling down for ${Math.ceil(remaining / 1000)}s after a rate limit`)
    );
  }

  const pending = inFlight.get(url);
  if (pending) return pending;

  const promise = startLoad(url).finally(() => {
    inFlight.delete(url);
  });

  inFlight.set(url, promise);
  evictOldest(inFlight);

  return promise;
};

export const loadImageSafe = async (url: string): Promise<HTMLImageElement | null> => {
  try {
    return await loadImageOnce(url);
  } catch {
    return null;
  }
};

export const isArtworkCoolingDown = (url: string): boolean =>
  cooldownFor(artworkIdentity(url), Date.now()) > 0;

export const clearImageCache = () => {
  inFlight.clear();
  loaded.clear();
  failures.clear();
};
