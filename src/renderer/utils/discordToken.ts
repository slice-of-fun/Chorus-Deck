import { useSettingsStore } from '@/store/modules/settings';

/** Mirrors EXPIRY_SKEW_MS from DiscordOAuthRepository.kt */
const EXPIRY_SKEW_MS = 60_000;

type TokenRefreshResult = {
  token: string;
  refreshToken?: string;
  expiresIn?: number;
};

// Dedupe concurrent refreshes (playerCore + DiscordTab can race): refresh
// tokens are single-use, so only one exchange may be in flight at a time.
let inflightRefresh: Promise<TokenRefreshResult> | null = null;

/**
 * Returns a valid Discord access token, transparently refreshing it when it
 * is expired (or about to expire), like DiscordOAuthRepository.getValidAccessToken()
 * in Chorus-Music. Falls back to the current token on any failure.
 *
 * Mutates the passed settings object so callers (playerCore / DiscordTab)
 * immediately send the fresh token, and persists it through the settings store.
 */
export async function ensureDiscordToken(settings: any): Promise<string> {
  const token: string = settings?.discordToken || '';
  if (!token) return '';

  const expiresAt: number = settings?.discordTokenExpiresAt || 0;
  if (!expiresAt || Date.now() + EXPIRY_SKEW_MS < expiresAt) {
    return token;
  }

  const refreshToken: string = settings?.discordRefreshToken || '';
  if (!refreshToken) return token;

  try {
    if (!inflightRefresh) {
      inflightRefresh = window.api
        .refreshDiscordToken(refreshToken)
        .finally(() => {
          inflightRefresh = null;
        });
    }
    const res = await inflightRefresh;
    if (res?.token) {
      const patch = {
        discordToken: res.token,
        discordRefreshToken: res.refreshToken || refreshToken,
        discordTokenExpiresAt: res.expiresIn ? Date.now() + res.expiresIn * 1000 : 0
      };
      settings.discordToken = patch.discordToken;
      settings.discordRefreshToken = patch.discordRefreshToken;
      settings.discordTokenExpiresAt = patch.discordTokenExpiresAt;
      await useSettingsStore().setSetData(patch);
      return patch.discordToken;
    }
  } catch (e) {
    console.warn('[discord] token refresh failed, using existing token', e);
  }

  return token;
}
