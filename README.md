# <img src="icons/icon48.png" alt="YouTube WL & Playlist Filters icon" width="32"> YouTube WL & Playlist Filters

A Chrome extension to enhance the interface of Youtube Playlist pages on desktop with filtering capabilities.

## Features

- Filter videos by channel
- Search through video titles
- Filter by video duration
- Create custom playlists from filtered videos
- Style adapted to Youtube interface (and adapts to light/dark mode)

## Installation

The extension will be available on the Chrome Web Store soon.

## Local Development

This project uses TypeScript, Webpack, and the Chrome Extension API.

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Chromium based browser supporting extensions

### Setup

1. Clone the repository
```bash
git clone https://github.com/thomasbarkats/youtube-wl-playlist-filters.git
cd youtube-wl-playlist-filters
```

2. Install dependencies
```bash
npm install
```

3. Build the project
```bash
npm run build
```

4. Load the extension in Chrome
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the project root directory

5. Start development with hot-reload
```bash
npm run dev
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
