# Development Hot Reload Setup

## Quick Start

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked" and select the `dist/` folder
   - The extension will be loaded and ready for development

3. Make changes to your code:
   - Edit any file in `src/`, `assets/`, or `_locales/`
   - The development server will automatically rebuild
   - Manually reload the extension in Chrome to see changes

## Development Commands

- `npm run dev` - Start hot reload development server
- `npm run dev:watch` - Start webpack in watch mode (alternative)
- `npm run build:dev` - One-time development build
- `npm run build` - Production build with minification

## How Hot Reload Works

The development server (`scripts/dev-server.js`) watches for changes in:

- `src/**/*.ts` - TypeScript source files
- `src/**/*.html` - HTML files
- `src/**/*.css` - CSS stylesheets
- `assets/**/*` - Asset files (sounds, icons)
- `_locales/**/*` - Localization files

When files change:

1. Debounced rebuild after 500ms (prevents excessive builds)
2. Webpack compiles TypeScript and copies assets to `dist/`
3. Console shows build status and instructions
4. Manually reload extension in Chrome to see changes

## Chrome Extension Reload

Chrome extensions require manual reload after code changes:

1. Go to `chrome://extensions/`
2. Find your "Thockify" extension
3. Click the refresh/reload icon
4. Test your changes

## Troubleshooting

- **Build fails**: Check console for TypeScript/ESLint errors
- **Changes not visible**: Ensure you reloaded the extension in Chrome
- **Extension not loading**: Check that you selected the `dist/` folder, not the project root
- **Console errors**: Check Chrome DevTools for runtime errors

## File Structure

```text
dist/                   # Built extension (load this in Chrome)
├── service-worker.js   # Background script
├── content-script.js   # Content script
├── popup.js           # Popup script
├── popup.html         # Popup HTML
├── popup.css          # Popup styles
├── assets/            # Assets (sounds, icons)
└── _locales/          # Localization files
```
