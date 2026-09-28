import { useRouter } from 'vue-router';

/**
 * Navigates to the YouTube Music artist page for a channel id.
 * The channel id may be supplied bare (`UC...`) or already prefixed.
 */
export const useArtist = () => {
  const router = useRouter();

  const navigateToArtist = (id: string) => {
    if (!id) return;

    const channelId = id.startsWith('UC') ? id : `UC${id.replace(/^UC/, '')}`;
    router.push(`/artist/${channelId}`);
  };

  return {
    navigateToArtist
  };
};
