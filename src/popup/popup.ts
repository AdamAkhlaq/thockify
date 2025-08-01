/**
 * Thockify Chrome Extension - Popup Script
 * Handles popup interface interactions and settings management
 */

import { ThockifySettings } from '../utils/storage.js';
import { MESSAGE_TYPES } from '../utils/constants.js';

class ThockifyPopup {
  private settings: ThockifySettings | null = null;
  private elements = {
    enableToggle: document.getElementById('enableToggle') as HTMLInputElement,
    statusDot: document.getElementById('statusDot') as HTMLElement,
    statusText: document.getElementById('statusText') as HTMLElement,
    speakerIcon: document.getElementById('speakerIcon') as HTMLButtonElement,
    volumeSlider: document.getElementById('volumeSlider') as HTMLInputElement,
    volumePercentage: document.getElementById(
      'volumePercentage'
    ) as HTMLElement,
    themeSelect: document.getElementById('themeSelect') as HTMLSelectElement,
  };

  /**
   * Initialize the popup
   */
  async initialize(): Promise<void> {
    try {
      await this.loadSettings();
      this.setupEventListeners();
      this.updateUI();
      console.log('Thockify popup initialized');
    } catch (error) {
      console.error('Failed to initialize popup:', error);
    }
  }

  /**
   * Load settings from background script
   */
  private async loadSettings(): Promise<void> {
    try {
      this.settings = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SETTINGS_GET,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Extension enable/disable toggle
    this.elements.enableToggle.addEventListener(
      'change',
      this.handleToggleChange.bind(this)
    );

    // Volume slider
    this.elements.volumeSlider.addEventListener(
      'input',
      this.handleVolumeChange.bind(this)
    );

    // Speaker icon (mute/unmute)
    this.elements.speakerIcon.addEventListener(
      'click',
      this.handleSpeakerClick.bind(this)
    );

    // Theme selection (for future implementation)
    this.elements.themeSelect.addEventListener(
      'change',
      this.handleThemeChange.bind(this)
    );
  }

  /**
   * Update UI based on current settings
   */
  private updateUI(): void {
    if (!this.settings) return;

    // Update toggle state
    this.elements.enableToggle.checked = this.settings.enabled;

    // Update status indicator
    this.elements.statusDot.className = `status-dot ${this.settings.enabled ? 'enabled' : 'disabled'}`;
    this.elements.statusText.textContent = this.settings.enabled
      ? 'Enabled'
      : 'Disabled';

    // Update volume controls
    const volumePercent = Math.round(this.settings.volume * 100);
    this.elements.volumeSlider.value = volumePercent.toString();
    this.elements.volumePercentage.textContent = `${volumePercent}%`;

    // Update speaker icon
    this.updateSpeakerIcon();

    // Update theme selection
    this.elements.themeSelect.value = this.settings.currentTheme;
  }

  /**
   * Update speaker icon based on volume
   */
  private updateSpeakerIcon(): void {
    if (!this.settings) return;

    const volume = this.settings.volume;

    if (volume === 0) {
      this.elements.speakerIcon.textContent = '🔇';
      this.elements.speakerIcon.setAttribute(
        'aria-label',
        'Unmute keyboard sounds'
      );
    } else if (volume < 0.5) {
      this.elements.speakerIcon.textContent = '🔉';
      this.elements.speakerIcon.setAttribute(
        'aria-label',
        'Mute keyboard sounds'
      );
    } else {
      this.elements.speakerIcon.textContent = '🔊';
      this.elements.speakerIcon.setAttribute(
        'aria-label',
        'Mute keyboard sounds'
      );
    }
  }

  /**
   * Handle extension toggle change
   */
  private async handleToggleChange(): Promise<void> {
    if (!this.settings) return;

    const enabled = this.elements.enableToggle.checked;

    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SETTINGS_UPDATE,
        updates: { enabled },
      });

      this.settings.enabled = enabled;
      this.updateUI();
    } catch (error) {
      console.error('Failed to update enabled setting:', error);
      // Revert toggle on error
      this.elements.enableToggle.checked = this.settings.enabled;
    }
  }

  /**
   * Handle volume slider change
   */
  private async handleVolumeChange(): Promise<void> {
    if (!this.settings) return;

    const volume = parseInt(this.elements.volumeSlider.value) / 100;

    try {
      // Store previous volume before changing
      if (this.settings.volume > 0) {
        this.settings.lastVolume = this.settings.volume;
      }

      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SETTINGS_UPDATE,
        updates: { volume, lastVolume: this.settings.lastVolume },
      });

      this.settings.volume = volume;
      this.updateUI();
    } catch (error) {
      console.error('Failed to update volume setting:', error);
    }
  }

  /**
   * Handle speaker icon click (mute/unmute)
   */
  private async handleSpeakerClick(): Promise<void> {
    if (!this.settings) return;

    let newVolume: number;

    if (this.settings.volume > 0) {
      // Mute: store current volume and set to 0
      this.settings.lastVolume = this.settings.volume;
      newVolume = 0;
    } else {
      // Unmute: restore last volume or default to 50%
      newVolume = this.settings.lastVolume || 0.5;
    }

    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.SETTINGS_UPDATE,
        updates: { volume: newVolume, lastVolume: this.settings.lastVolume },
      });

      this.settings.volume = newVolume;
      this.updateUI();
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
  }

  /**
   * Handle theme selection change (placeholder for future implementation)
   */
  private async handleThemeChange(): Promise<void> {
    // This will be implemented in a future phase
    console.log('Theme selection will be implemented in a future update');
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popup = new ThockifyPopup();
  popup.initialize();
});
