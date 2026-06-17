import { YOUTUBE_SELECTORS as SELECTORS, DURATION_THRESHOLDS } from './config/youtube-selectors';
import { CurrentFilters, VideoStats, DurationThresholds } from './types/PlaylistPageEnhancer.types';
import { debounce, searchInText } from './utils/search.utils';
import { getElement, getAllElements } from './utils/dom-helpers';

const LOG_TITLE = 'YouTube WL & Playlist Filters';

class PlaylistPageEnhancer {
  private channelFilters: Set<string>;
  // Videos already scanned for channel info, to skip re-scanning each batch
  private processedVideos: WeakSet<Element>;
  private currentFilters: CurrentFilters;
  private debouncedSearch: (value: string, filterKey: keyof CurrentFilters) => void;
  // true for the lockup layout (channel playlists), false for the classic one
  private modern: boolean;
  private videoObserver?: MutationObserver;
  // Prevents concurrent UI rebuilds
  private building: boolean;
  private currentUrl: string;
  // Caps ensureUI to one call per frame
  private ensureScheduled: boolean;

  constructor() {
    this.channelFilters = new Set<string>();
    this.processedVideos = new WeakSet<Element>();
    this.modern = false;
    this.building = false;
    this.currentUrl = window.location.href;
    this.ensureScheduled = false;
    this.currentFilters = {
      channel: '',
      channelSearch: '',
      titleSearch: '',
      duration: '',
      watchStatus: '',
    };

    // Create debounced search function with our custom debounce
    this.debouncedSearch = debounce((value: string, filterKey: keyof CurrentFilters) => {
      this.currentFilters[filterKey] = value;
      this.updateResetButtons();
      this.applyFilters();
    }, 300);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  private async init(): Promise<void> {
    await this.injectStyles();
    // Delegated listeners survive UI rebuilds, so wire them only once
    this.setupGlobalListeners();
    this.watchPage();
    this.ensureUI();
  }

  // Scoped to the main column to skip sidebar/related lockups
  private classicItemSelector(): string {
    return `${SELECTORS.PLAYLIST_CONTAINER} ${SELECTORS.VIDEO_ITEM}`;
  }
  private modernItemSelector(): string {
    // Require the playlist section so we don't match the home feed's lockups
    // (which would inject the bar into the wrong container during navigation)
    return `#primary ${SELECTORS.MODERN.LIST_SECTION} ${SELECTORS.MODERN.VIDEO_ITEM}`;
  }

  // Pick the layout that actually has videos; classic wins on ambiguity
  private detectLayout(): void {
    const hasClassic = getAllElements(this.classicItemSelector()).length > 0;
    const hasModern = getAllElements(this.modernItemSelector()).length > 0;
    this.modern = !hasClassic && hasModern;
  }

  // Selector for an individual video in the active layout
  private videoItemSelector(): string {
    return this.modern ? SELECTORS.MODERN.VIDEO_ITEM : SELECTORS.VIDEO_ITEM;
  }

  // Video list element: observed for new items and anchors the filter bar
  private getListContainer(): Element | null {
    if (this.modern) {
      return getElement(this.modernItemSelector())?.closest(SELECTORS.MODERN.LIST_CONTENTS) ?? null;
    }
    return getElement(SELECTORS.PLAYLIST_CONTAINER);
  }

  // Playlist videos, scoped to the list container
  private getVideoElements(): Element[] {
    const container = this.getListContainer();
    if (!container) return [];
    return Array.from(container.querySelectorAll(this.videoItemSelector()));
  }

  // Re-inject the UI whenever it goes missing (re-renders, SPA navigation)
  private watchPage(): void {
    const observer = new MutationObserver(() => {
      this.handleUrlChange();
      this.scheduleEnsure();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Coalesce a burst of mutations into one ensureUI per frame
  private scheduleEnsure(): void {
    if (this.ensureScheduled) return;
    this.ensureScheduled = true;
    requestAnimationFrame(() => {
      this.ensureScheduled = false;
      this.ensureUI();
    });
  }

  // On navigation, reset state and drop the stale bar for a fresh rebuild
  private handleUrlChange(): void {
    if (window.location.href === this.currentUrl) return;
    this.currentUrl = window.location.href;

    getElement(`.${SELECTORS.FILTER_CONTAINER}`)?.remove();
    Object.keys(this.currentFilters).forEach(key => {
      this.currentFilters[key as keyof CurrentFilters] = '';
    });
  }

  // Inject the filter UI if we are on a playlist page and it is not present yet
  private async ensureUI(): Promise<void> {
    if (this.building) return;
    if (!window.location.href.includes('/playlist?')) return;

    this.detectLayout();
    const container = this.getListContainer();
    if (!container) return;

    // Done if the bar is already attached to the current container. Checking the
    // placement (not just presence) lets us rebuild when a transitional render
    // leaves the bar orphaned or in the wrong container.
    const bar = getElement(`.${SELECTORS.FILTER_CONTAINER}`);
    const expectedParent = this.modern ? container.parentElement : container;
    if (bar && bar.parentElement === expectedParent) return;

    this.building = true;
    try {
      bar?.remove();
      // Fresh build for this container: drop any channels picked up from the
      // previous playlist's videos during a transition
      this.channelFilters.clear();
      this.processedVideos = new WeakSet<Element>();
      const created = await this.createFilterUI();
      if (created) {
        this.setupInputListeners();
        this.initCompactView();
      }
      this.startVideoProcessing();
    } finally {
      this.building = false;
    }
  }

  // Event delegation helper to handle both direct and delegated events
  private addEvent(selector: string | Element, event: string, handler: (e: Event, element: Element | null) => void): void {
    if (typeof selector === 'string') {
      document.addEventListener(event, (e: Event) => {
        const target = e.target as Element;
        const element = target.closest(selector);
        if (element) handler(e, element);
      });
    } else {
      selector.addEventListener(event, (e: Event) => handler(e, selector));
    }
  }

  private async injectStyles(): Promise<void> {
    try {
      const response = await fetch(chrome.runtime.getURL('styles/styles.css'));
      const css = await response.text();
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    } catch (error) {
      this.logError('Failed to load styles:', error);
    }
  }

  // Inject the filter bar above the list; returns false if already present
  private async createFilterUI(): Promise<boolean> {
    try {
      const container = this.getListContainer();
      if (!container) return false;
      if (getElement(`.${SELECTORS.FILTER_CONTAINER}`)) return false;

      const response = await fetch(chrome.runtime.getURL('templates/filterContainer.html'));
      const html = await response.text();

      const filterContainer = document.createElement('div');
      filterContainer.className = SELECTORS.FILTER_CONTAINER;
      filterContainer.innerHTML = html;

      if (this.modern) {
        // Lockup grid is a leaf; place the bar just above it
        container.parentElement?.insertBefore(filterContainer, container);
      } else {
        container.insertBefore(filterContainer, container.firstChild);
      }
      return true;
    } catch (error) {
      this.logError('Failed to create UI:', error);
      return false;
    }
  }

  // Observe DOM changes to detect new videos being loaded
  private startVideoProcessing(): void {
    const container = this.getListContainer();
    if (!container) return;

    // Drop any observer bound to a previous container
    this.videoObserver?.disconnect();

    // Process initial videos
    this.processVideos(this.getVideoElements());
    this.applyFilters();

    // Observe new videos
    const observer = new MutationObserver((mutations) => {
      let hasNewVideos = false;
      for (const mutation of mutations) {
        if (this.containsNewVideos(mutation.addedNodes)) {
          hasNewVideos = true;
          break;
        }
      }
      if (hasNewVideos) {
        // Wait for duration elements to be available
        const checkDurations = async () => {
          const newVideos = this.getVideoElements();
          const allDurationsLoaded = newVideos.every(
            video => this.hasDurationLoaded(video)
          );
          if (allDurationsLoaded) {
            this.processVideos(newVideos);
            this.applyFilters();
          } else {
            setTimeout(checkDurations, 100);
          }
        };
        checkDurations();
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true
    });

    this.videoObserver = observer;
  }

  // Helper method to check for new videos
  private containsNewVideos(nodes: NodeList): boolean {
    const itemSelector = this.videoItemSelector();
    for (const node of nodes) {
      if (node instanceof Element) {
        if (node.matches(itemSelector)) return true;
        if (node.querySelector(itemSelector)) return true;
      }
    }
    return false;
  }

  // Whether the video's duration element has rendered yet
  private hasDurationLoaded(video: Element): boolean {
    const selector = this.modern ? SELECTORS.MODERN.VIDEO_DURATION : SELECTORS.VIDEO_DURATION;
    return !!video.querySelector(selector);
  }

  // The video's title link (also the source of its watch URL)
  private getVideoLink(video: Element): HTMLAnchorElement | null {
    if (this.modern) {
      // The thumbnail link is aria-hidden; the visible one carries the title
      return (video.querySelector(`${SELECTORS.MODERN.VIDEO_LINK}:not([aria-hidden="true"])`)
        ?? video.querySelector(SELECTORS.MODERN.VIDEO_LINK)) as HTMLAnchorElement | null;
    }
    return video.querySelector(SELECTORS.VIDEO_TITLE) as HTMLAnchorElement | null;
  }

  private getVideoTitle(video: Element): string {
    const link = this.getVideoLink(video);
    return link?.textContent?.trim() || link?.getAttribute('aria-label')?.trim() || '';
  }

  // Channel name, or '' when the layout has none (single-channel playlists)
  private getVideoChannel(video: Element): string {
    if (this.modern) {
      return video.querySelector(SELECTORS.MODERN.CHANNEL_LINK)?.textContent?.trim() || '';
    }
    return (video.querySelector(SELECTORS.CHANNEL_NAME) as HTMLElement)?.title || '';
  }

  // Raw duration text (MM:SS or HH:MM:SS)
  private getDurationText(video: Element): string | null {
    if (this.modern) {
      // Several badges exist; keep the one shaped like a timestamp
      for (const badge of video.querySelectorAll(SELECTORS.MODERN.VIDEO_DURATION)) {
        const text = badge.textContent?.trim() || '';
        if (/^\d+(:\d{2})+$/.test(text)) return text;
      }
      return null;
    }
    return video.querySelector(SELECTORS.VIDEO_DURATION)?.textContent?.trim() || null;
  }

  // Parse video duration in total seconds (MM:SS or HH:MM:SS)
  private getVideoDurationInSeconds(video: Element): number | null {
    const timeText = this.getDurationText(video);
    if (!timeText) return null;
    const parts = timeText.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }

  // Returns duration in minutes (for duration range filtering and stats)
  private getVideoDuration(video: Element): number | null {
    const seconds = this.getVideoDurationInSeconds(video);
    return seconds !== null ? seconds / 60 : null;
  }

  // Determine watch status from progress bar and video duration
  // - watched: progress >= 95%
  // - started: at least 30 seconds watched (but < 95%)
  // - unwatched: no progress or < 30 seconds (covers autoplay hover previews)
  private getWatchStatus(video: Element): 'watched' | 'started' | 'unwatched' {
    const selector = this.modern ? SELECTORS.MODERN.VIDEO_PROGRESS : SELECTORS.VIDEO_PROGRESS;
    const progressEl = video.querySelector(selector) as HTMLElement | null;
    if (!progressEl) return 'unwatched';

    const progressPercent = parseFloat(progressEl.style.width);
    if (isNaN(progressPercent) || progressPercent <= 0) return 'unwatched';
    if (progressPercent >= 95) return 'watched';

    const totalSeconds = this.getVideoDurationInSeconds(video);
    if (totalSeconds !== null) {
      const watchedSeconds = (progressPercent / 100) * totalSeconds;
      return watchedSeconds >= 30 ? 'started' : 'unwatched';
    }

    // Duration unavailable, trust that any progress > 0 means started
    return 'started';
  }

  // Check if video duration falls within selected range
  private isInDurationRange(duration: number | null, range: string): boolean {
    if (!range || !duration) return true;

    const threshold = (DURATION_THRESHOLDS as DurationThresholds)[range];
    if (!threshold) return true;

    const { min = -Infinity, max = Infinity } = threshold;
    return duration >= min && (max === Infinity || duration < max);
  }

  // Bind listeners directly to the filter inputs (recreated on each UI rebuild)
  private setupInputListeners(): void {
    // Filter inputs configuration
    const filterInputs = {
      select: [
        { selector: SELECTORS.FILTER_INPUTS.CHANNEL, event: 'change' },
        { selector: SELECTORS.FILTER_INPUTS.DURATION, event: 'change' },
        { selector: SELECTORS.FILTER_INPUTS.WATCH_STATUS, event: 'change' }
      ],
      search: [
        { selector: SELECTORS.FILTER_INPUTS.CHANNEL_SEARCH, event: 'input' },
        { selector: SELECTORS.FILTER_INPUTS.TITLE_SEARCH, event: 'input' }
      ]
    };

    // Setup select inputs
    filterInputs.select.forEach(({ selector }) => {
      const element = getElement(selector) as HTMLSelectElement;
      if (element) {
        element.addEventListener('change', () => {
          this.currentFilters[this.getFilterKey(selector)] = element.value;
          this.updateResetButtons();
          this.applyFilters();
        });
      }
    });

    // Setup search inputs
    filterInputs.search.forEach(({ selector }) => {
      const element = getElement(selector) as HTMLInputElement;
      if (element) {
        element.addEventListener('input', (e: Event) => {
          const value = (e.target as HTMLInputElement).value;
          this.debouncedSearch(value, this.getFilterKey(selector));
        });
      }
    });
  }

  // Set up delegated listeners on document (wired once, survive UI rebuilds)
  private setupGlobalListeners(): void {
    // Reset filter buttons
    this.addEvent('.reset-filter', 'click', (e: Event, button: Element | null) => {
      const fieldId = (button as HTMLElement).dataset.for;
      if (fieldId) {
        const field = getElement(`#${fieldId}`) as HTMLInputElement | HTMLSelectElement;
        if (field) {
          field.value = '';
          this.currentFilters[this.getFilterKey(`#${fieldId}`)] = '';
          this.updateResetButtons();
          this.applyFilters();
        }
      }
    });

    // Global reset button
    this.addEvent(SELECTORS.RESET_ALL_BTN, 'click', () => this.resetAllFilters());

    // Play filtered videos button
    this.addEvent(SELECTORS.PLAY_FILTERED_BTN, 'click', () => this.createAndPlayFilteredPlaylist());
  }

  // Map selectors to filter keys
  private getFilterKey(selector: string): keyof CurrentFilters {
    const selectorToKey: { [key: string]: keyof CurrentFilters } = {
      [SELECTORS.FILTER_INPUTS.CHANNEL]: 'channel',
      [SELECTORS.FILTER_INPUTS.CHANNEL_SEARCH]: 'channelSearch',
      [SELECTORS.FILTER_INPUTS.TITLE_SEARCH]: 'titleSearch',
      [SELECTORS.FILTER_INPUTS.DURATION]: 'duration',
      [SELECTORS.FILTER_INPUTS.WATCH_STATUS]: 'watchStatus',
    };
    return selectorToKey[selector];
  }

  // Format duration for display (converts minutes to HH:MM:SS or MM:SS)
  private formatDuration(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    const seconds = Math.round((totalMinutes % 1) * 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  // Calculate stats for visible videos (count and total duration)
  private calculateVideoStats(visibleVideos: Element[]): VideoStats {
    const totalMinutes = visibleVideos.reduce((total, video) => {
      const duration = this.getVideoDuration(video);
      return total + (duration || 0);
    }, 0);

    return {
      count: visibleVideos.length,
      duration: this.formatDuration(totalMinutes)
    };
  }

  private initCompactView(): void {
    const toggleInput = document.querySelector('#toggleCompactView') as HTMLInputElement;
    if (!toggleInput) {
      console.error('Toggle input not found');
      return;
    }

    // Apply saved state
    const isCompact = localStorage.getItem('yt-wl-compact-view') === 'true';
    toggleInput.checked = isCompact;

    const container = this.getListContainer();
    if (isCompact && container) {
      container.classList.add('compact-view');
    }

    toggleInput.addEventListener('change', () => {
      if (container) {
        container.classList.toggle('compact-view');
        localStorage.setItem('yt-wl-compact-view', toggleInput.checked.toString());
      }
    });
  }

  // Helper to handle filter reset actions
  private resetAllFilters(): void {
    // Reset all form inputs
    getAllElements('select, input').forEach(field => {
      (field as HTMLInputElement | HTMLSelectElement).value = '';
    });

    // Reset filter states
    Object.keys(this.currentFilters).forEach(key => {
      this.currentFilters[key as keyof CurrentFilters] = '';
    });

    this.updateResetButtons();
    this.applyFilters();
    this.updateFilterUI();
  }

  // Toggle visibility of individual reset buttons
  private updateResetButtons(): void {
    getAllElements('.reset-filter').forEach(button => {
      const fieldId = (button as HTMLElement).dataset.for;
      if (fieldId) {
        const field = getElement(`#${fieldId}`);
        if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
          (button as HTMLElement).style.display = field.value ? '' : 'none';
        }
      }
    });
  }

  // Create and open a new playlist with currently visible videos
  private async createAndPlayFilteredPlaylist(): Promise<void> {
    try {
      // Get video IDs of visible videos
      const videoIds = this.getVideoElements()
        .filter(video => (video as HTMLElement).style.display !== 'none')
        .map(video => {
          const link = this.getVideoLink(video)?.href;
          return link ? link.split('v=')[1].split('&')[0] : null;
        })
        .filter((id): id is string => id !== null);

      if (videoIds.length === 0) return;

      // Open YouTube's watch_videos URL with selected videos
      const playlistUrl = `https://www.youtube.com/watch_videos?video_ids=${videoIds.join(',')}`;
      window.open(playlistUrl, '_blank');
    } catch (error) {
      this.logError('Error creating filtered playlist:', error);
    }
  }

  // Apply all active filters to the video list
  private applyFilters(): void {
    const videos = this.getVideoElements();
    const visibleVideos = this.getVisibleVideos(videos);
    const visibleSet = new Set(visibleVideos);

    // Update video visibility (Set lookup keeps this O(n) on large playlists)
    videos.forEach(video => {
      (video as HTMLElement).style.display = visibleSet.has(video) ? '' : 'none';
    });

    // Update stats display
    const stats = this.calculateVideoStats(visibleVideos);
    const statsTextElement = getElement(SELECTORS.STATS_TEXT);
    const infoIcon = getElement(SELECTORS.STATS_INFO_ICON);
    if (statsTextElement) {
      statsTextElement.textContent = this.hasActiveFilters()
        ? `${stats.count} videos • ${stats.duration} total`
        : '';
    }
    // The (i) warns that only the videos loaded so far are counted/filtered
    if (infoIcon) {
      (infoIcon as HTMLElement).style.display = this.hasActiveFilters() ? '' : 'none';
    }

    // Update UI elements based on filter state
    const resetButton = getElement(SELECTORS.RESET_ALL_BTN);
    if (resetButton) {
      resetButton.classList.toggle('active', this.hasActiveFilters());
    }

    const playButton = getElement(SELECTORS.PLAY_FILTERED_BTN) as HTMLElement;
    if (playButton) {
      playButton.style.display = (this.hasActiveFilters() && visibleVideos.length >= 2) ? '' : 'none';
    }
  }

  // Check if any filters are currently active
  private hasActiveFilters(): boolean {
    return Object.values(this.currentFilters).some(value => value !== '');
  }

  // Update channel filter dropdown with available channels
  private updateFilterUI(): void {
    const select = getElement(SELECTORS.FILTER_INPUTS.CHANNEL) as HTMLSelectElement;
    if (!select) return;

    const currentValue = select.value;

    // Rebuild channel options
    select.innerHTML = '<option value="">All Channels</option>';
    Array.from(this.channelFilters)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .forEach(channel => {
        const option = document.createElement('option');
        option.value = channel;
        option.textContent = channel;
        select.appendChild(option);
      });

    if (currentValue) {
      select.value = currentValue;
    }

    this.updateChannelFilterVisibility();
  }

  // Hide channel filter/search when no channel names are available
  private updateChannelFilterVisibility(): void {
    const hasChannels = this.channelFilters.size > 0;
    [SELECTORS.FILTER_INPUTS.CHANNEL, SELECTORS.FILTER_INPUTS.CHANNEL_SEARCH].forEach(selector => {
      const row = getElement(selector)?.closest('.filter-row') as HTMLElement | null;
      if (row) row.style.display = hasChannels ? '' : 'none';
    });
  }

  // Process displayed videos to extract channel info and categorize them
  private async processVideos(videoElements: Iterable<Element>): Promise<void> {
    try {
      for (const video of videoElements) {
        // Skip videos already seen, so each batch only handles new items
        if (this.processedVideos.has(video)) continue;
        this.processedVideos.add(video);
        const channel = this.getVideoChannel(video);
        if (channel) this.channelFilters.add(channel);
      }
      this.updateFilterUI();
    } catch (error) {
      this.logError('Error processing videos:', error);
    }
  }

  // Get list of videos that match current filters
  private getVisibleVideos(videos: Element[] = this.getVideoElements()): Element[] {
    return videos
      .filter(video => {
        // If no filters are active, show all videos
        if (!this.hasActiveFilters()) return true;

        const channel = this.getVideoChannel(video);
        const title = this.getVideoTitle(video);
        const duration = this.getVideoDuration(video);

        if (this.currentFilters.channel && channel !== this.currentFilters.channel) return false;
        if (this.currentFilters.channelSearch && !searchInText(channel, this.currentFilters.channelSearch)) return false;
        if (this.currentFilters.titleSearch && !searchInText(title, this.currentFilters.titleSearch)) return false;
        if (this.currentFilters.duration && !this.isInDurationRange(duration, this.currentFilters.duration)) return false;
        if (this.currentFilters.watchStatus && this.getWatchStatus(video) !== this.currentFilters.watchStatus) return false;

        return true;
      });
  }

  private logError(msg: string, err: unknown): void {
    console.error(`[${LOG_TITLE}] ${msg}`, err);
  }
}

// Initialize the extension
new PlaylistPageEnhancer();
