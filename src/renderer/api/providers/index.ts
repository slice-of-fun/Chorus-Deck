import type { SearchProvider } from '../provider';
import { ytmProvider } from './ytmusic';

export const providers: Record<string, SearchProvider> = {
  ytmusic: ytmProvider
};

export function getProvider(): SearchProvider {
  return ytmProvider;
}
