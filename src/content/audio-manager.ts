/**
 * Thockify Chrome Extension - Audio Manager
 * Manages Web Audio API for low-latency keyboard sound playback
 */

import {
  ThockifyAudioContext,
  KeyType,
  createAudioContext,
  loadAudioBuffer,
  playAudioBuffer,
} from '../utils/audio-utils.js';
import { PATHS } from '../utils/constants.js';

export class AudioManager {
  private audioContext: ThockifyAudioContext | null = null;
  private isInitialized = false;
  private preloadingPromise: Promise<void> | null = null;

  /**
   * Initialize the audio system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = createAudioContext();
      await this.preloadSounds();
      this.isInitialized = true;
      console.log('Thockify AudioManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
      throw error;
    }
  }

  /**
   * Preload all sound files
   */
  private async preloadSounds(): Promise<void> {
    if (!this.audioContext) throw new Error('Audio context not available');

    this.preloadingPromise = (async () => {
      const soundFiles = Object.entries(PATHS.SOUND_FILES);
      const loadPromises = soundFiles.map(async ([keyType, filename]) => {
        try {
          const url = chrome.runtime.getURL(`${PATHS.SOUNDS_DIR}/${filename}`);
          const buffer = await loadAudioBuffer(this.audioContext!, url);
          this.audioContext!.buffers!.set(keyType, buffer);
        } catch (error) {
          console.warn(`Failed to load sound for ${keyType}:`, error);
        }
      });

      await Promise.allSettled(loadPromises);
    })();

    await this.preloadingPromise;
  }

  /**
   * Play sound for specific key type
   */
  async playKeySound(keyType: KeyType, volume: number = 1.0): Promise<void> {
    if (!this.isInitialized || !this.audioContext) {
      console.warn('AudioManager not initialized');
      return;
    }

    // Wait for preloading to complete if still in progress
    if (this.preloadingPromise) {
      await this.preloadingPromise;
    }

    // Resume audio context if suspended (required after user interaction)
    if (this.audioContext.context?.state === 'suspended') {
      try {
        await this.audioContext.context.resume();
      } catch (error) {
        console.error('Failed to resume audio context:', error);
        return;
      }
    }

    const buffer = this.audioContext.buffers?.get(keyType);
    if (!buffer) {
      console.warn(`No audio buffer available for key type: ${keyType}`);
      return;
    }

    playAudioBuffer(this.audioContext, buffer, volume);
  }

  /**
   * Set master volume
   */
  setVolume(volume: number): void {
    if (this.audioContext?.gainNode) {
      this.audioContext.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Check if audio system is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.audioContext?.context) {
      this.audioContext.context.close();
    }
    this.audioContext = null;
    this.isInitialized = false;
    this.preloadingPromise = null;
  }
}
