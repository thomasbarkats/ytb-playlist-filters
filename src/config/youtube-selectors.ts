export const YOUTUBE_SELECTORS = {
  // Container selectors
  PLAYLIST_CONTAINER: 'ytd-playlist-video-list-renderer',
  VIDEO_ITEM: 'ytd-playlist-video-renderer',

  // Video information selectors
  CHANNEL_NAME: 'yt-formatted-string#text[title]',
  VIDEO_TITLE: '#video-title',
  VIDEO_DURATION: '#text.ytd-thumbnail-overlay-time-status-renderer',
  THUMBNAIL: 'ytd-thumbnail',

  // Modern layout used by single-channel playlists (lockup view-model)
  MODERN: {
    LIST_CONTENTS: '#contents',
    VIDEO_ITEM: 'yt-lockup-view-model',
    VIDEO_LINK: 'a[href*="watch?v="]',
    CHANNEL_LINK: 'a[href*="/@"], a[href*="/channel/"], a[href*="/user/"]',
    VIDEO_DURATION: '.ytBadgeShapeText',
    VIDEO_PROGRESS: '.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
  },

  // Custom UI selectors
  FILTER_CONTAINER: 'yt-wl-filters-container',
  FILTER_INPUTS: {
    CHANNEL: '#channelFilter',
    CHANNEL_SEARCH: '#channelSearch',
    TITLE_SEARCH: '#titleSearch',
    DURATION: '#durationFilter',
    CATEGORY: '#categoryFilter',
    WATCH_STATUS: '#watchStatusFilter'
  },

  // Progress bar indicating how much of the video has been watched
  VIDEO_PROGRESS: 'ytd-thumbnail-overlay-resume-playback-renderer #progress',

  // Buttons
  RESET_ALL_BTN: '#resetAllFilters',
  PLAY_FILTERED_BTN: '#playFilteredVideos',

  // Stats display
  STATS_TEXT: '.stats-text',
  STATS_INFO_ICON: '.stats-info-icon'
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
