/**
 * Thockify Chrome Extension - Audio Utilities
 * Helper functions for audio processing and sound management
 */

export interface ThockifyAudioContext {
  context?: AudioContext;
  gainNode?: GainNode;
  buffers?: Map<string, AudioBuffer>;
}

export type KeyType = 'generic' | 'backspace' | 'enter' | 'space';
export type SoundAction = 'press' | 'release';

/**
 * Classify key based on event properties for press/release sounds
 */
export function classifyKey(event: KeyboardEvent): KeyType {
  const key = event.key.toLowerCase();
  const code = event.code.toLowerCase();

  // Space key
  if (key === ' ' || code === 'space') {
    return 'space';
  }

  // Enter key
  if (key === 'enter' || code === 'enter') {
    return 'enter';
  }

  // Backspace key
  if (key === 'backspace' || code === 'backspace') {
    return 'backspace';
  }

  // All other keys (alphanumeric, symbols, modifiers, etc.)
  return 'generic';
}

/**
 * Create optimized audio context with proper configuration
 */
export function createAudioContext(): ThockifyAudioContext {
  try {
    // Use the standard AudioContext constructor
    const context = new (window.AudioContext ||
      (window as any).webkitAudioContext)({
      latencyHint: 'interactive', // Optimize for low latency
      sampleRate: 44100, // Standard sample rate
    });

    // Create master gain node for volume control
    const gainNode = context.createGain();
    gainNode.connect(context.destination);

    return {
      context,
      gainNode,
      buffers: new Map(),
    };
  } catch (error) {
    console.error('Failed to create audio context:', error);
    throw new Error('Audio not supported in this browser');
  }
}

/**
 * Load audio buffer from URL
 */
export async function loadAudioBuffer(
  audioContext: ThockifyAudioContext,
  url: string
): Promise<AudioBuffer> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.context!.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error(`Failed to load audio buffer from ${url}:`, error);
    throw error;
  }
}

/**
 * Play audio buffer with specified gain
 */
export function playAudioBuffer(
  audioContext: ThockifyAudioContext,
  buffer: AudioBuffer,
  gain: number = 1.0
): void {
  if (!audioContext.context || !audioContext.gainNode) {
    console.warn('Audio context not available');
    return;
  }

  try {
    const source = audioContext.context.createBufferSource();
    source.buffer = buffer;

    // Apply gain
    audioContext.gainNode.gain.value = Math.max(0, Math.min(1, gain));

    source.connect(audioContext.gainNode);
    source.start(0);
  } catch (error) {
    console.error('Failed to play audio buffer:', error);
  }
}
