import 'vue-router';

/**
 * Route metadata used across the sidebar, layout and window-title logic.
 * Declared here so route definitions stay type-checked.
 */
declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    icon?: string;
    /** Hidden from the desktop sidebar menu. */
    hideInSidebar?: boolean;
    /** Set to `false` to keep a route off the mobile menu. */
    isMobile?: boolean;
    keepAlive?: boolean;
    noScroll?: boolean;
    /** Marks the entry that the mobile header back button should target. */
    back?: boolean;
    /** Local audio track resolved for a media-session / SMTC entry. */
    filePath?: string;
  }
}

export {};
