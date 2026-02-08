export const YOUTUBE_SELECTORS = {
  // Container selectors
  PLAYLIST_CONTAINER: 'ytd-playlist-video-list-renderer',
  VIDEO_ITEM: 'ytd-playlist-video-renderer',

  // Video information selectors
  CHANNEL_NAME: 'yt-formatted-string#text[title]',
  VIDEO_TITLE: '#video-title',
  VIDEO_DURATION: '#text.ytd-thumbnail-overlay-time-status-renderer',
  THUMBNAIL: 'ytd-thumbnail',

  // Custom UI selectors
  FILTER_CONTAINER: 'yt-wl-filters-container',
  FILTER_INPUTS: {
    CHANNEL: '#channelFilter',
    CHANNEL_SEARCH: '#channelSearch',
    TITLE_SEARCH: '#titleSearch',
    DURATION: '#durationFilter',
    CATEGORY: '#categoryFilter'
  },

  // Buttons
  RESET_ALL_BTN: '#resetAllFilters',
  PLAY_FILTERED_BTN: '#playFilteredVideos',

  // Stats display
  STATS_TEXT: '.stats-text',
  STATS_INFO_ICON: '.stats-info-icon'
};

export const YT_CSS_VARS = {
  // YouTube theme variables
  BACKGROUND: '--yt-spec-base-background',
  TEXT_PRIMARY: '--yt-spec-text-primary',
  TEXT_SECONDARY: '--yt-spec-text-secondary',
  RAISED_BACKGROUND: '--yt-spec-raised-background',
  CALL_TO_ACTION: '--yt-spec-call-to-action',
  CALL_TO_ACTION_INVERSE: '--yt-spec-call-to-action-inverse',
  MENU_BACKGROUND: '--yt-spec-menu-background',
  OUTLINE: '--yt-spec-outline'
};


export const DURATION_RANGES = {
  SHORT: '0-10',
  MEDIUM: '10-20',
  MEDIUM_LONG: '20-30',
  LONG: '30-45',
  VERY_LONG: '45+'
};

export const DURATION_THRESHOLDS = {
  [DURATION_RANGES.SHORT]: { max: 10 },
  [DURATION_RANGES.MEDIUM]: { min: 10, max: 20 },
  [DURATION_RANGES.MEDIUM_LONG]: { min: 20, max: 30 },
  [DURATION_RANGES.LONG]: { min: 30, max: 45 },
  [DURATION_RANGES.VERY_LONG]: { min: 45 }
};
