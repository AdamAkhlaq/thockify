/**
 * Thockify Chrome Extension - Audio Manager
 * Manages Web Audio API for low-latency keyboard sound playback with press/release sounds
 */

import {
  ThockifyAudioContext,
  KeyType,
  SoundAction,
  createAudioContext,
  loadAudioBuffer,
} from '../utils/audio-utils.js';
import { PATHS, AUDIO_CONFIG } from '../utils/constants.js';

export class AudioManager {
  private audioContext: ThockifyAudioContext | null = null;
  private isInitialized = false;
  private preloadingPromise: Promise<void> | null = null;
  private masterGainNode: GainNode | null = null;
  private readonly activeSourceNodes = new Set<AudioBufferSourceNode>();

  /**
   * Initialize the audio system with enhanced Web Audio API features
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create audio context with optimized settings
      this.audioContext = createAudioContext();

      if (!this.audioContext.context) {
        throw new Error('Failed to create audio context');
      }

      // Create master gain node for global volume control
      this.masterGainNode = this.audioContext.context.createGain();
      this.masterGainNode.gain.value = AUDIO_CONFIG.DEFAULT_VOLUME;
      this.masterGainNode.connect(this.audioContext.context.destination);

      // Resume audio context if suspended (required for autoplay policies)
      if (this.audioContext.context.state === 'suspended') {
        await this.audioContext.context.resume();
      }

      await this.preloadSounds();
      this.isInitialized = true;
      console.log('Thockify AudioManager initialized with Web Audio API');
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
      throw error;
    }
  }

  /**
   * Preload all sound files for press/release actions
   */
  private async preloadSounds(): Promise<void> {
    if (!this.audioContext) throw new Error('Audio context not available');

    this.preloadingPromise = (async () => {
      const loadPromises: Promise<void>[] = [];

      // Load press sounds
      for (const [keyType, filename] of Object.entries(
        PATHS.SOUND_FILES.press
      )) {
        loadPromises.push(this.loadSoundBuffer('press', keyType, filename));
      }

      // Load release sounds
      for (const [keyType, filename] of Object.entries(
        PATHS.SOUND_FILES.release
      )) {
        loadPromises.push(this.loadSoundBuffer('release', keyType, filename));
      }

      await Promise.allSettled(loadPromises);
      console.log('Audio buffers preloaded for press/release sounds');
    })();

    await this.preloadingPromise;
  }

  /**
   * Load individual sound buffer
   */
  private async loadSoundBuffer(
    action: SoundAction,
    keyType: string,
    filename: string
  ): Promise<void> {
    try {
      const url = chrome.runtime.getURL(`${PATHS.SOUNDS_DIR}/${filename}`);
      const buffer = await loadAudioBuffer(this.audioContext!, url);
      const bufferKey = `${action}:${keyType}`;
      this.audioContext!.buffers!.set(bufferKey, buffer);
    } catch (error) {
      console.warn(`Failed to load ${action} sound for ${keyType}:`, error);
    }
  }

  /**
   * Play sound for specific key type and action (press/release)
   */
  async playKeySound(
    keyType: KeyType,
    action: SoundAction,
    volume: number = 1.0
  ): Promise<void> {
    if (!this.isInitialized || !this.audioContext || !this.masterGainNode) {
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

    const bufferKey = `${action}:${keyType}`;
    const buffer = this.audioContext.buffers?.get(bufferKey);
    if (!buffer) {
      console.warn(
        `No audio buffer available for ${action} sound of ${keyType}`
      );
      return;
    }

    try {
      // Create and configure audio source
      const source = this.audioContext.context!.createBufferSource();
      source.buffer = buffer;

      // Create individual gain node for this sound
      const gainNode = this.audioContext.context!.createGain();
      gainNode.gain.value = Math.max(0, Math.min(1, volume));

      // Connect: source -> gainNode -> masterGainNode -> destination
      source.connect(gainNode);
      gainNode.connect(this.masterGainNode);

      // Track active source for cleanup
      this.activeSourceNodes.add(source);
      source.onended = () => {
        this.activeSourceNodes.delete(source);
      };

      // Play the sound
      source.start(0);
    } catch (error) {
      console.error(`Failed to play ${action} sound for ${keyType}:`, error);
    }
  }

  /**
   * Set master volume for all sounds
   */
  setVolume(volume: number): void {
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Check if audio system is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null;
  }

  /**
   * Cleanup resources and stop all active sounds
   */
  destroy(): void {
    // Stop all active audio sources
    this.activeSourceNodes.forEach(source => {
      try {
        source.stop();
      } catch (error) {
        // Source may already be stopped
      }
    });
    this.activeSourceNodes.clear();

    // Close audio context
    if (this.audioContext?.context) {
      this.audioContext.context.close();
    }

    // Reset all properties
    this.audioContext = null;
    this.masterGainNode = null;
    this.isInitialized = false;
    this.preloadingPromise = null;
  }
}
