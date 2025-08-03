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
  private readonly audioBuffers = new Map<string, AudioBuffer>();
  private preloadStartTime: number = 0;
  private loadingStats = {
    totalFiles: 0,
    loadedFiles: 0,
    failedFiles: 0,
  };
  private currentVolume: number = AUDIO_CONFIG.DEFAULT_VOLUME;
  private isMuted: boolean = false;
  private volumeBeforeMute: number = AUDIO_CONFIG.DEFAULT_VOLUME;

  // Audio buffer pooling system
  private readonly sourceNodePool = new Set<AudioBufferSourceNode>();
  private readonly gainNodePool = new Set<GainNode>();
  private readonly maxPoolSize: number = AUDIO_CONFIG.MAX_CONCURRENT_SOUNDS;
  private concurrentSoundsCount: number = 0;

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

      // Initialize buffer pools
      this.initializeBufferPools();

      await this.preloadSounds();
      this.isInitialized = true;
      console.log(
        'Thockify AudioManager initialized with Web Audio API and buffer pooling'
      );
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
      throw error;
    }
  }

  /**
   * Initialize buffer pools for efficient resource management
   */
  private initializeBufferPools(): void {
    if (!this.audioContext?.context) return;

    // Pre-create gain nodes for the pool
    for (let i = 0; i < Math.min(this.maxPoolSize, 5); i++) {
      const gainNode = this.audioContext.context.createGain();
      this.gainNodePool.add(gainNode);
    }

    console.debug(
      `Initialized buffer pools with ${this.gainNodePool.size} gain nodes`
    );
  }

  /**
   * Acquire a gain node from the pool or create a new one
   */
  private acquireGainNode(): GainNode | null {
    if (!this.audioContext?.context) return null;

    let gainNode = this.gainNodePool.values().next().value;
    if (gainNode) {
      this.gainNodePool.delete(gainNode);
      // Reset the gain node state
      gainNode.gain.value = 1.0;
      gainNode.disconnect();
    } else {
      // Create new gain node if pool is empty
      gainNode = this.audioContext.context.createGain();
    }

    return gainNode;
  }

  /**
   * Release a gain node back to the pool
   */
  private releaseGainNode(gainNode: GainNode): void {
    if (this.gainNodePool.size < this.maxPoolSize) {
      // Reset state and return to pool
      gainNode.gain.value = 1.0;
      gainNode.disconnect();
      this.gainNodePool.add(gainNode);
    }
    // If pool is full, let it be garbage collected
  }

  /**
   * Check if we can play more concurrent sounds
   */
  private canPlayConcurrentSound(): boolean {
    return this.concurrentSoundsCount < this.maxPoolSize;
  }

  /**
   * Increment concurrent sounds counter
   */
  private incrementConcurrentSounds(): void {
    this.concurrentSoundsCount++;
  }

  /**
   * Decrement concurrent sounds counter
   */
  private decrementConcurrentSounds(): void {
    this.concurrentSoundsCount = Math.max(0, this.concurrentSoundsCount - 1);
  }

  /**
   * Get current concurrent sounds statistics
   */
  getConcurrentSoundsStats(): {
    active: number;
    maxAllowed: number;
    pooledGainNodes: number;
    poolUtilization: number;
  } {
    return {
      active: this.concurrentSoundsCount,
      maxAllowed: this.maxPoolSize,
      pooledGainNodes: this.gainNodePool.size,
      poolUtilization: this.concurrentSoundsCount / this.maxPoolSize,
    };
  }

  /**
   * Preload all sound files for press/release actions with optimized buffer management
   */
  private async preloadSounds(): Promise<void> {
    if (!this.audioContext) throw new Error('Audio context not available');

    this.preloadStartTime = performance.now();

    // Reset loading stats
    this.loadingStats = { totalFiles: 0, loadedFiles: 0, failedFiles: 0 };

    // Calculate total files to load
    this.loadingStats.totalFiles =
      Object.keys(PATHS.SOUND_FILES.press).length +
      Object.keys(PATHS.SOUND_FILES.release).length;

    this.preloadingPromise = this.executePreloading();
    await this.preloadingPromise;

    const loadTime = performance.now() - this.preloadStartTime;
    console.log(
      `Audio preloading completed in ${loadTime.toFixed(2)}ms - ` +
        `Loaded: ${this.loadingStats.loadedFiles}/${this.loadingStats.totalFiles}, ` +
        `Failed: ${this.loadingStats.failedFiles}`
    );

    // Validate we have essential sounds loaded
    if (this.loadingStats.loadedFiles === 0) {
      throw new Error('Failed to load any audio files');
    }
  }

  /**
   * Execute the actual preloading with timeout and error handling
   */
  private async executePreloading(): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    // Load press sounds with high priority
    for (const [keyType, filename] of Object.entries(PATHS.SOUND_FILES.press)) {
      loadPromises.push(
        this.loadSoundBufferWithTimeout(
          'press',
          keyType,
          filename,
          AUDIO_CONFIG.PRELOAD_TIMEOUT
        )
      );
    }

    // Load release sounds with normal priority
    for (const [keyType, filename] of Object.entries(
      PATHS.SOUND_FILES.release
    )) {
      loadPromises.push(
        this.loadSoundBufferWithTimeout(
          'release',
          keyType,
          filename,
          AUDIO_CONFIG.PRELOAD_TIMEOUT
        )
      );
    }

    // Wait for all loading attempts to complete (some may fail)
    await Promise.allSettled(loadPromises);
  }

  /**
   * Load individual sound buffer with timeout and improved error handling
   */
  private async loadSoundBufferWithTimeout(
    action: SoundAction,
    keyType: string,
    filename: string,
    timeoutMs: number
  ): Promise<void> {
    const bufferKey = `${action}:${keyType}`;

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Timeout loading ${bufferKey}`)),
          timeoutMs
        );
      });

      // Create loading promise
      const loadingPromise = this.loadSoundBuffer(action, keyType, filename);

      // Race between loading and timeout
      await Promise.race([loadingPromise, timeoutPromise]);

      this.loadingStats.loadedFiles++;
      console.debug(`Successfully loaded ${bufferKey}`);
    } catch (error) {
      this.loadingStats.failedFiles++;
      console.warn(`Failed to load ${bufferKey}:`, error);

      // For critical sounds, try fallback to generic if available
      if (keyType !== 'generic' && this.shouldUseFallback(action, keyType)) {
        try {
          await this.loadFallbackBuffer(action, keyType);
          console.info(`Using fallback for ${bufferKey}`);
        } catch (fallbackError) {
          console.error(
            `Fallback also failed for ${bufferKey}:`,
            fallbackError
          );
        }
      }
    }
  }

  /**
   * Load individual sound buffer (core loading logic)
   */
  private async loadSoundBuffer(
    action: SoundAction,
    keyType: string,
    filename: string
  ): Promise<void> {
    const url = chrome.runtime.getURL(`${PATHS.SOUNDS_DIR}/${filename}`);
    const buffer = await loadAudioBuffer(this.audioContext!, url);
    const bufferKey = `${action}:${keyType}`;

    // Store in both the audio context and local buffer map
    this.audioContext!.buffers!.set(bufferKey, buffer);
    this.audioBuffers.set(bufferKey, buffer);
  }

  /**
   * Check if fallback should be used for failed sound loading
   */
  private shouldUseFallback(action: SoundAction, keyType: string): boolean {
    // Use fallback for special keys if generic sound is available
    const genericKey = `${action}:generic`;
    return (
      ['backspace', 'enter', 'space'].includes(keyType) &&
      !this.audioBuffers.has(`${action}:${keyType}`) &&
      this.audioBuffers.has(genericKey)
    );
  }

  /**
   * Load fallback buffer (generic sound for specific key types)
   */
  private async loadFallbackBuffer(
    action: SoundAction,
    keyType: string
  ): Promise<void> {
    const genericKey = `${action}:generic`;
    const fallbackKey = `${action}:${keyType}`;

    const genericBuffer = this.audioBuffers.get(genericKey);
    if (genericBuffer) {
      // Use generic buffer as fallback
      this.audioContext!.buffers!.set(fallbackKey, genericBuffer);
      this.audioBuffers.set(fallbackKey, genericBuffer);
      this.loadingStats.loadedFiles++;
    }
  }

  /**
   * Play sound for specific key type and action with enhanced volume control and buffer pooling
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

    // Skip playback if muted
    if (this.isMuted) {
      return;
    }

    // Check concurrent sound limits
    if (!this.canPlayConcurrentSound()) {
      console.debug('Maximum concurrent sounds reached, skipping playback');
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
    const buffer =
      this.audioBuffers.get(bufferKey) ||
      this.audioContext.buffers?.get(bufferKey);
    if (!buffer) {
      console.warn(
        `No audio buffer available for ${action} sound of ${keyType}`
      );
      return;
    }

    try {
      // Create audio source (cannot be pooled as they're single-use)
      const source = this.audioContext.context!.createBufferSource();
      source.buffer = buffer;

      // Acquire gain nodes from pool
      const soundGainNode = this.acquireGainNode();
      const keyTypeGainNode = this.acquireGainNode();

      if (!soundGainNode || !keyTypeGainNode) {
        console.warn('Failed to acquire gain nodes from pool');
        return;
      }

      // Configure gain nodes
      const clampedVolume = Math.max(0, Math.min(1, volume));
      soundGainNode.gain.value = clampedVolume;
      keyTypeGainNode.gain.value = this.getKeyTypeVolumeMultiplier(keyType);

      // Connect audio graph: source -> soundGain -> keyTypeGain -> masterGain -> destination
      source.connect(soundGainNode);
      soundGainNode.connect(keyTypeGainNode);
      keyTypeGainNode.connect(this.masterGainNode);

      // Track active source and increment counter
      this.activeSourceNodes.add(source);
      this.incrementConcurrentSounds();

      // Set up cleanup when sound ends
      source.onended = () => {
        this.activeSourceNodes.delete(source);
        this.decrementConcurrentSounds();

        // Return gain nodes to pool
        this.releaseGainNode(soundGainNode);
        this.releaseGainNode(keyTypeGainNode);
      };

      // Play the sound
      source.start(0);
    } catch (error) {
      console.error(`Failed to play ${action} sound for ${keyType}:`, error);
    }
  }

  /**
   * Get volume multiplier for different key types
   */
  private getKeyTypeVolumeMultiplier(keyType: KeyType): number {
    // Different key types can have different volume levels for realism
    switch (keyType) {
      case 'space':
        return 1.1; // Space bar slightly louder
      case 'enter':
        return 1.05; // Enter slightly louder
      case 'backspace':
        return 0.95; // Backspace slightly quieter
      case 'generic':
      default:
        return 1.0; // Normal volume
    }
  }

  /**
   * Set master volume with smooth ramping and mute state management
   */
  setVolume(volume: number, rampTimeMs: number = 0): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.currentVolume = clampedVolume;

    if (!this.masterGainNode) {
      console.warn('Master gain node not available');
      return;
    }

    try {
      // Handle mute state
      if (clampedVolume === 0 && !this.isMuted) {
        this.volumeBeforeMute =
          this.currentVolume > 0 ? this.currentVolume : this.volumeBeforeMute;
        this.isMuted = true;
      } else if (clampedVolume > 0 && this.isMuted) {
        this.isMuted = false;
      }

      const targetVolume = this.isMuted ? 0 : clampedVolume;

      if (rampTimeMs > 0 && this.audioContext?.context) {
        // Smooth volume ramping
        const currentTime = this.audioContext.context.currentTime;
        this.masterGainNode.gain.cancelScheduledValues(currentTime);
        this.masterGainNode.gain.setValueAtTime(
          this.masterGainNode.gain.value,
          currentTime
        );
        this.masterGainNode.gain.linearRampToValueAtTime(
          targetVolume,
          currentTime + rampTimeMs / 1000
        );
      } else {
        // Immediate volume change
        this.masterGainNode.gain.value = targetVolume;
      }
    } catch (error) {
      console.error('Failed to set volume:', error);
    }
  }

  /**
   * Get current volume level
   */
  getVolume(): number {
    return this.currentVolume;
  }

  /**
   * Toggle mute state
   */
  toggleMute(): boolean {
    if (this.isMuted) {
      this.setVolume(this.volumeBeforeMute);
    } else {
      this.volumeBeforeMute = this.currentVolume;
      this.setVolume(0);
    }
    return this.isMuted;
  }

  /**
   * Set mute state explicitly
   */
  setMute(muted: boolean): void {
    if (muted && !this.isMuted) {
      this.volumeBeforeMute = this.currentVolume;
      this.setVolume(0);
    } else if (!muted && this.isMuted) {
      this.setVolume(this.volumeBeforeMute);
    }
  }

  /**
   * Check if currently muted
   */
  isMutedState(): boolean {
    return this.isMuted;
  }

  /**
   * Fade volume in/out with smooth ramping
   */
  fadeVolume(
    targetVolume: number,
    durationMs: number = AUDIO_CONFIG.VOLUME_FADE_DURATION * 1000
  ): void {
    this.setVolume(targetVolume, durationMs);
  }

  /**
   * Stop all currently playing sounds
   */
  stopAllSounds(): void {
    this.activeSourceNodes.forEach(source => {
      try {
        source.stop();
      } catch (error) {
        // Source may already be stopped
      }
    });
    this.activeSourceNodes.clear();
    this.concurrentSoundsCount = 0;
    console.debug('All sounds stopped');
  }

  /**
   * Check if audio system is ready with buffer validation
   */
  isReady(): boolean {
    const hasContext = this.isInitialized && this.audioContext !== null;
    const hasBuffers = this.audioBuffers.size > 0;
    const preloadingComplete =
      this.preloadingPromise === null || this.loadingStats.loadedFiles > 0;

    return hasContext && hasBuffers && preloadingComplete;
  }

  /**
   * Get detailed preloading statistics
   */
  getPreloadingStats(): {
    isComplete: boolean;
    totalFiles: number;
    loadedFiles: number;
    failedFiles: number;
    loadedBuffers: string[];
    loadTimeMs?: number;
  } {
    const stats = {
      isComplete: this.preloadingPromise === null,
      totalFiles: this.loadingStats.totalFiles,
      loadedFiles: this.loadingStats.loadedFiles,
      failedFiles: this.loadingStats.failedFiles,
      loadedBuffers: Array.from(this.audioBuffers.keys()),
    };

    if (this.preloadStartTime > 0) {
      return {
        ...stats,
        loadTimeMs: performance.now() - this.preloadStartTime,
      };
    }

    return stats;
  }

  /**
   * Cleanup resources and stop all active sounds
   */
  destroy(): void {
    // Stop all active audio sources
    this.stopAllSounds();

    // Close audio context
    if (this.audioContext?.context) {
      this.audioContext.context.close();
    }

    // Clear buffer maps
    this.audioBuffers.clear();
    if (this.audioContext?.buffers) {
      this.audioContext.buffers.clear();
    }

    // Clear buffer pools
    this.sourceNodePool.clear();
    this.gainNodePool.clear();

    // Reset all properties including volume state and pooling counters
    this.audioContext = null;
    this.masterGainNode = null;
    this.isInitialized = false;
    this.preloadingPromise = null;
    this.preloadStartTime = 0;
    this.loadingStats = { totalFiles: 0, loadedFiles: 0, failedFiles: 0 };
    this.currentVolume = AUDIO_CONFIG.DEFAULT_VOLUME;
    this.isMuted = false;
    this.volumeBeforeMute = AUDIO_CONFIG.DEFAULT_VOLUME;
    this.concurrentSoundsCount = 0;
  }
}
