/**
 * Thockify Chrome Extension - Constants
 * Application-wide constants and configuration values
 */

// Extension metadata
export const EXTENSION_NAME = 'Thockify';
export const EXTENSION_VERSION = '1.0.0';
export const EXTENSION_ID = 'thockify-mechanical-keyboard-sounds';

// Audio configuration
export const AUDIO_CONFIG = {
  // Audio context settings
  SAMPLE_RATE: 44100,
  LATENCY_HINT: 'interactive' as AudioContextLatencyCategory,

  // Volume settings
  DEFAULT_VOLUME: 0.5,
  MIN_VOLUME: 0.0,
  MAX_VOLUME: 1.0,
  VOLUME_STEP: 0.1,

  // Audio file settings
  SUPPORTED_FORMATS: ['wav', 'mp3', 'ogg', 'm4a'],
  PREFERRED_FORMAT: 'wav',

  // Performance settings
  MAX_CONCURRENT_SOUNDS: 10,
  PRELOAD_TIMEOUT: 5000, // 5 seconds
  VOLUME_FADE_DURATION: 0.1, // 100ms
} as const;

// Storage configuration
export const STORAGE_CONFIG = {
  // Chrome storage sync limits
  QUOTA_BYTES: 102400, // 100KB
  MAX_ITEMS: 512,
  MAX_WRITE_OPERATIONS_PER_MINUTE: 120,

  // Settings keys
  SETTINGS_KEY: 'thockify_settings',
  CACHE_KEY: 'thockify_cache',

  // Cache settings
  CACHE_VERSION: 1,
  CACHE_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Message types for extension communication
export const MESSAGE_TYPES = {
  // Content script to background
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  AUDIO_PLAY: 'audio:play',

  // Background to content script
  SETTINGS_CHANGED: 'settings:changed',
  EXTENSION_TOGGLED: 'extension:toggled',

  // Popup messages
  POPUP_OPENED: 'popup:opened',
  POPUP_CLOSED: 'popup:closed',

  // Error handling
  ERROR_OCCURRED: 'error:occurred',
  WARNING_OCCURRED: 'warning:occurred',
} as const;

// UI configuration
export const UI_CONFIG = {
  // Popup dimensions
  POPUP_WIDTH: 320,
  POPUP_MIN_HEIGHT: 200,

  // Animation durations
  TRANSITION_DURATION: 200, // ms
  TOAST_DURATION: 3000, // ms

  // Theme configuration
  THEMES: [
    { id: 'mechanical-blue', name: 'Mechanical Blue' },
    { id: 'cherry-red', name: 'Cherry Red' },
    { id: 'brown-tactile', name: 'Brown Tactile' },
    { id: 'linear-black', name: 'Linear Black' },
    { id: 'custom', name: 'Custom' },
  ],
  DEFAULT_THEME: 'mechanical-blue',
} as const;

// File paths and URLs
export const PATHS = {
  // Extension paths
  POPUP_HTML: 'src/popup/popup.html',
  CONTENT_SCRIPT: 'src/content/content-script.js',
  SERVICE_WORKER: 'src/background/service-worker.js',

  // Asset paths
  SOUNDS_DIR: 'assets/sounds',
  ICONS_DIR: 'assets/icons',

  // Sound files - press/release structure
  SOUND_FILES: {
    press: {
      generic: 'alpaca/press/GENERIC.mp3',
      backspace: 'alpaca/press/BACKSPACE.mp3',
      enter: 'alpaca/press/ENTER.mp3',
      space: 'alpaca/press/SPACE.mp3',
    },
    release: {
      generic: 'alpaca/release/GENERIC.mp3',
      backspace: 'alpaca/release/BACKSPACE.mp3',
      enter: 'alpaca/release/ENTER.mp3',
      space: 'alpaca/release/SPACE.mp3',
    },
  },

  // Icon files
  ICON_FILES: {
    16: 'icon-16.png',
    48: 'icon-48.png',
    128: 'icon-128.png',
  },
} as const;
