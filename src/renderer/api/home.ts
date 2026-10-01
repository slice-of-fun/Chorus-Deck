/**
 * Home / discovery helpers for the YouTube Music browse experience.
 *
 * These previously lived in a module that was never ported, leaving
 * `views/compact-search` importing a non-existent path. They now call the
 * backend through the Tauri bridge.
 */

const invokeYtm = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  window.api.invoke<T>(channel, ...args);

/** The single keyword YouTube Music is currently promoting. */
export async function getSearchKeyword(): Promise<{ showKeyword: string }> {
  const res = await invokeYtm<{ success: boolean; data?: { showKeyword: string } }>(
    'ytm:search-keyword'
  );
  return res?.data ?? { showKeyword: '' };
}

/** Trending search terms, most popular first. */
export async function getHotSearch(): Promise<string[]> {
  const res = await invokeYtm<{ success: boolean; data?: string[] }>('ytm:hot-search');
  return res?.data ?? [];
}
