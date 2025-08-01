/**
 * Thockify Chrome Extension - Content Script
 * Detects keystrokes and plays corresponding mechanical keyboard sounds
 */

import { AudioManager } from './audio-manager.js';
import { classifyKey } from '../utils/audio-utils.js';
import { ThockifySettings } from '../utils/storage.js';
import { MESSAGE_TYPES } from '../utils/constants.js';

class ThockifyContentScript {
  private audioManager = new AudioManager();
  private settings: ThockifySettings | null = null;
  private isInitialized = false;
  private lastKeystroke = 0;
  private readonly DEBOUNCE_DELAY = 50; // ms

  /**
   * Initialize the content script
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load initial settings
      await this.loadSettings();

      // Initialize audio manager if extension is enabled
      if (this.settings?.enabled) {
        await this.audioManager.initialize();
      }

      // Set up event listeners
      this.setupKeyboardListeners();
      this.setupMessageListeners();

      this.isInitialized = true;
      console.log('Thockify content script initialized');
    } catch (error) {
      console.error('Failed to initialize Thockify content script:', error);
    }
  }

  /**
   * Load settings from background script
   */
  private async loadSettings(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SETTINGS_GET,
      });
      this.settings = response;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Set up keyboard event listeners
   */
  private setupKeyboardListeners(): void {
    // Use passive listeners for better performance
    document.addEventListener('keydown', this.handleKeydown.bind(this), {
      passive: true,
      capture: true,
    });
  }

  /**
   * Set up message listeners for communication with background script
   */
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
      switch (message.type) {
        case MESSAGE_TYPES.SETTINGS_CHANGED:
          this.handleSettingsChanged(message.changes);
          break;
      }
    });
  }

  /**
   * Handle keyboard events
   */
  private async handleKeydown(event: KeyboardEvent): Promise<void> {
    // Skip if extension is disabled
    if (!this.settings?.enabled) return;

    // Skip if audio manager is not ready
    if (!this.audioManager.isReady()) return;

    // Debounce rapid keystrokes
    const now = Date.now();
    if (now - this.lastKeystroke < this.DEBOUNCE_DELAY) return;
    this.lastKeystroke = now;

    // Skip certain key combinations
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    // Classify the key type
    const keyType = classifyKey(event);

    // Check if this key type is enabled in settings
    const audioSettings = this.settings.audioSettings;
    if (keyType === 'spacebar' && !audioSettings.enableSpacebarSound) return;
    if (keyType === 'enter' && !audioSettings.enableEnterSound) return;
    if (keyType === 'shift' && !audioSettings.enableShiftSound) return;

    // Play the appropriate sound
    try {
      await this.audioManager.playKeySound(keyType, this.settings.volume);
    } catch (error) {
      console.error('Failed to play key sound:', error);
    }
  }

  /**
   * Handle settings changes from background script
   */
  private async handleSettingsChanged(changes: {
    [key: string]: chrome.storage.StorageChange;
  }): Promise<void> {
    // Update local settings
    await this.loadSettings();

    // Handle volume changes
    if (changes.volume) {
      this.audioManager.setVolume(this.settings?.volume || 0);
    }

    // Handle enable/disable
    if (changes.enabled) {
      if (this.settings?.enabled && !this.audioManager.isReady()) {
        await this.audioManager.initialize();
      } else if (!this.settings?.enabled) {
        this.audioManager.destroy();
      }
    }
  }
}

// Initialize the content script when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const contentScript = new ThockifyContentScript();
    contentScript.initialize();
  });
} else {
  const contentScript = new ThockifyContentScript();
  contentScript.initialize();
}
