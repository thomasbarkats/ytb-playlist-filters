# YouTube Playlist Filters

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore/detail/idecjbacpbnbijnbekemooobjpffogab)
[![Version](https://img.shields.io/chrome-web-store/v/idecjbacpbnbijnbekemooobjpffogab?label=Version)](https://chrome.google.com/webstore/detail/idecjbacpbnbijnbekemooobjpffogab)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Chrome (Chromium browsers) extension that enhances YouTube playlist pages with powerful filtering capabilities. Perfect for managing large playlists and Watch Later content.

## ✨ Features

- **Channel Filtering**: Easily filter videos by channel name
- **Smart Search**: Search through video titles with instant results
- **Duration Filter**: Find videos based on their length (short/medium/long)
- **Privacy-Focused**: Works entirely client-side with no data collection
- **Playlist Management**: Create custom playlists from filtered videos
- **Native Look & Feel**: Seamlessly integrates with YouTube's interface
- **Theme Support**: Automatically adapts to YouTube's light/dark mode
- **Performance**: Minimal impact on page load time

## 🪄 Usage

After installation:
1. Navigate to any YouTube playlist or Watch Later page
2. Look for the new filter controls above the video list
3. Filter by channel using the dropdown menu
4. Use duration filters to find videos of specific lengths
5. Search by title or channel to find specific videos
6. Select videos and create new playlists with filtered content

## Installation

You can install the extension from the [Chrome Web Store](https://chrome.google.com/webstore/detail/idecjbacpbnbijnbekemooobjpffogab).

## Local Development

This project uses TypeScript, Webpack, and the Chrome Extension API.

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Chromium based browser supporting extensions

### Setup

1. Clone the repository
```bash
git clone https://github.com/thomasbarkats/ytb-playlist-filters.git
cd ytb-playlist-filters
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
   - Click "Load unpacked" and select the project `/package` directory

5. Start development with hot-reload
```bash
npm run watch
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
