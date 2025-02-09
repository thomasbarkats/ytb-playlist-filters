import { YOUTUBE_SELECTORS as SELECTORS, DURATION_THRESHOLDS } from './config/youtube-selectors';
import { CurrentFilters, VideoStats, DurationThresholds } from './types/PlaylistPageEnhancer.types';
import { debounce } from './utils/debounce';
import { getElement, getAllElements, waitForElement } from './utils/dom-helpers';

const LOG_TITLE = 'YouTube WL & Playlist Filters';

class PlaylistPageEnhancer {
  private channelFilters: Set<string>;
  private currentFilters: CurrentFilters;
  private debouncedSearch: (value: string, filterKey: keyof CurrentFilters) => void;

  constructor() {
    this.channelFilters = new Set<string>();
    this.currentFilters = {
      channel: '',
      channelSearch: '',
      titleSearch: '',
      duration: '',
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
    // Wait for YouTube's playlist container to be available
    await waitForElement(SELECTORS.PLAYLIST_CONTAINER);
    await this.injectStyles();
    await this.createFilterUI();
    this.setupEventListeners();
    this.initCompactView();
    this.startVideoProcessing();
    this.watchNavigationChanges();
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
      const response = await fetch(chrome.runtime.getURL('src/styles/styles.css'));
      const css = await response.text();
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    } catch (error) {
      this.logError('Failed to load styles:', error);
    }
  }

  private async createFilterUI(): Promise<void> {
    try {
      const response = await fetch(chrome.runtime.getURL('src/templates/filterContainer.html'));
      const html = await response.text();

      const filterContainer = document.createElement('div');
      filterContainer.className = SELECTORS.FILTER_CONTAINER;
      filterContainer.innerHTML = html;

      const primaryInner = getElement(SELECTORS.PLAYLIST_CONTAINER);
      if (primaryInner) {
        primaryInner.insertBefore(filterContainer, primaryInner.firstChild);
      }
    } catch (error) {
      this.logError('Failed to create UI:', error);
    }
  }

  // Observe DOM changes to detect new videos being loaded
  private startVideoProcessing(): void {
    const container = getElement(SELECTORS.PLAYLIST_CONTAINER);
    if (!container) return;

    // Process initial videos
    this.processVideos(getAllElements(SELECTORS.VIDEO_ITEM));
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
          const newVideos = getAllElements(SELECTORS.VIDEO_ITEM);
          const allDurationsLoaded = Array.from(newVideos).every(
            video => video.querySelector(SELECTORS.VIDEO_DURATION)
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
  }

  // Helper method to check for new videos
  private containsNewVideos(nodes: NodeList): boolean {
    for (const node of nodes) {
      if (node instanceof Element) {
        if (node.matches(SELECTORS.VIDEO_ITEM)) return true;
        if (node.querySelector(SELECTORS.VIDEO_ITEM)) return true;
        if (node.matches(SELECTORS.PLAYLIST_CONTAINER)) return true;
      }
    }
    return false;
  }

  // Parse video duration from YouTube's time format (MM:SS or HH:MM:SS)
  private getVideoDuration(video: Element): number | null {
    const timeText = video.querySelector(SELECTORS.VIDEO_DURATION)?.textContent?.trim();
    if (!timeText) return null;

    const parts = timeText.split(':').map(Number);
    // Convert to minutes: handle both MM:SS and HH:MM:SS formats
    return parts.length === 2 ? parts[0] : parts.length === 3 ? parts[0] * 60 + parts[1] : null;
  }

  // Check if video duration falls within selected range
  private isInDurationRange(duration: number | null, range: string): boolean {
    if (!range || !duration) return true;

    const threshold = (DURATION_THRESHOLDS as DurationThresholds)[range];
    if (!threshold) return true;

    const { min = -Infinity, max = Infinity } = threshold;
    return duration >= min && (max === Infinity || duration < max);
  }

  // Set up all event listeners for filters and buttons
  private setupEventListeners(): void {
    // Filter inputs configuration
    const filterInputs = {
      select: [
        { selector: SELECTORS.FILTER_INPUTS.CHANNEL, event: 'change' },
        { selector: SELECTORS.FILTER_INPUTS.DURATION, event: 'change' }
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

    const container = document.querySelector(SELECTORS.PLAYLIST_CONTAINER);
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
      const videoIds = Array.from(getAllElements(SELECTORS.VIDEO_ITEM))
        .filter(video => (video as HTMLElement).style.display !== 'none')
        .map(video => {
          const link = (video.querySelector(SELECTORS.VIDEO_TITLE) as HTMLAnchorElement)?.href;
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
    const visibleVideos = this.getVisibleVideos();

    // Update video visibility
    getAllElements(SELECTORS.VIDEO_ITEM).forEach(video => {
      (video as HTMLElement).style.display = visibleVideos.includes(video) ? '' : 'none';
    });

    // Update stats display
    const stats = this.calculateVideoStats(visibleVideos);
    const statsTextElement = getElement(SELECTORS.STATS_TEXT);
    const infoIcon = getElement(SELECTORS.STATS_INFO_ICON);
    if (statsTextElement && infoIcon) {
      if (this.hasActiveFilters()) {
        statsTextElement.textContent = `${stats.count} videos • ${stats.duration} total`;
        (infoIcon as HTMLElement).style.display = '';
      } else {
        statsTextElement.textContent = '';
        (infoIcon as HTMLElement).style.display = 'none';
      }
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
  }

  // Process displayed videos to extract channel info and categorize them
  private async processVideos(videoElements: NodeListOf<Element>): Promise<void> {
    try {
      for (const video of videoElements) {
        const channelElement = video.querySelector(SELECTORS.CHANNEL_NAME) as HTMLElement;
        if (channelElement?.title) {
          this.channelFilters.add(channelElement.title);
        }
      }
      this.updateFilterUI();
    } catch (error) {
      this.logError('Error processing videos:', error);
    }
  }

  // Watch for URL changes to reinitialize on playlist navigation
  private watchNavigationChanges(): void {
    let lastUrl = window.location.href;

    const observer = new MutationObserver(async () => {
      const currentUrl = window.location.href;
      if (currentUrl === lastUrl) return;

      lastUrl = currentUrl;
      if (!currentUrl.includes('/playlist?')) return;

      await waitForElement(SELECTORS.PLAYLIST_CONTAINER);
      this.channelFilters.clear();
      this.resetAllFilters();

      const container = getElement(SELECTORS.PLAYLIST_CONTAINER);
      if (container) {
        this.processVideos(getAllElements(SELECTORS.VIDEO_ITEM));
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true
    });
  }

  // Get list of videos that match current filters
  private getVisibleVideos(): Element[] {
    return Array.from(getAllElements(SELECTORS.VIDEO_ITEM))
      .filter(video => {
        // If no filters are active, show all videos
        if (!this.hasActiveFilters()) return true;

        const channel = (video.querySelector(SELECTORS.CHANNEL_NAME) as HTMLElement)?.title || '';
        const title = video.querySelector(SELECTORS.VIDEO_TITLE)?.textContent?.trim() || '';
        const duration = this.getVideoDuration(video);

        // Channel filter
        if (this.currentFilters.channel && channel !== this.currentFilters.channel) return false;

        // Channel search
        if (this.currentFilters.channelSearch &&
          !channel.toLowerCase().includes(this.currentFilters.channelSearch.toLowerCase())) return false;

        // Title search
        if (this.currentFilters.titleSearch &&
          !title.toLowerCase().includes(this.currentFilters.titleSearch.toLowerCase())) return false;

        // Duration filter
        if (this.currentFilters.duration && !this.isInDurationRange(duration, this.currentFilters.duration)) return false;

        return true;
      });
  }

  private logError(msg: string, err: unknown): void {
    console.error(`[${LOG_TITLE}] ${msg}`, err);
  }
}

// Initialize the extension
new PlaylistPageEnhancer();
