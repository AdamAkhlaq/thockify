/**
 * Thockify Chrome Extension - Storage Utilities
 * Provides type-safe wrapper around chrome.storage.sync API
 */

export interface ThockifySettings {
  enabled: boolean;
  volume: number;
  lastVolume?: number;
  currentTheme: string;
  keyboardShortcuts: {
    toggle: string;
    volumeUp: string;
    volumeDown: string;
    mute: string;
  };
  audioSettings: {
    enableDifferentiatedSounds: boolean;
    enableSpacebarSound: boolean;
    enableEnterSound: boolean;
    enableShiftSound: boolean;
  };
  uiSettings: {
    showVolumeInBadge: boolean;
    darkMode: boolean;
  };
}

export const DEFAULT_SETTINGS: ThockifySettings = {
  enabled: true,
  volume: 0.5,
  lastVolume: 0.5,
  currentTheme: 'mechanical-blue',
  keyboardShortcuts: {
    toggle: 'Ctrl+Shift+T',
    volumeUp: 'Ctrl+Shift+Up',
    volumeDown: 'Ctrl+Shift+Down',
    mute: 'Ctrl+Shift+M',
  },
  audioSettings: {
    enableDifferentiatedSounds: true,
    enableSpacebarSound: true,
    enableEnterSound: true,
    enableShiftSound: true,
  },
  uiSettings: {
    showVolumeInBadge: false,
    darkMode: false,
  },
};

export class StorageManager {
  /**
   * Get all settings with fallback to defaults
   */
  static async getSettings(): Promise<ThockifySettings> {
    try {
      const stored = await chrome.storage.sync.get(null);
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        // Ensure nested objects are properly merged
        keyboardShortcuts: {
          ...DEFAULT_SETTINGS.keyboardShortcuts,
          ...(stored.keyboardShortcuts || {}),
        },
        audioSettings: {
          ...DEFAULT_SETTINGS.audioSettings,
          ...(stored.audioSettings || {}),
        },
        uiSettings: {
          ...DEFAULT_SETTINGS.uiSettings,
          ...(stored.uiSettings || {}),
        },
      };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Update specific setting values
   */
  static async updateSettings(
    updates: Partial<ThockifySettings>
  ): Promise<void> {
    try {
      await chrome.storage.sync.set(updates);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  /**
   * Get a specific setting value
   */
  static async getSetting<K extends keyof ThockifySettings>(
    key: K
  ): Promise<ThockifySettings[K]> {
    try {
      const result = await chrome.storage.sync.get([key]);
      return result[key] ?? DEFAULT_SETTINGS[key];
    } catch (error) {
      console.error(`Failed to get setting ${key}:`, error);
      return DEFAULT_SETTINGS[key];
    }
  }

  /**
   * Set a specific setting value
   */
  static async setSetting<K extends keyof ThockifySettings>(
    key: K,
    value: ThockifySettings[K]
  ): Promise<void> {
    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch (error) {
      console.error(`Failed to set setting ${key}:`, error);
      throw new Error(`Failed to save ${key}`);
    }
  }

  /**
   * Reset all settings to defaults
   */
  static async resetSettings(): Promise<void> {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(DEFAULT_SETTINGS);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw new Error('Failed to reset settings');
    }
  }
}
