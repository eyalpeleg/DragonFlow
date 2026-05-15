import { setAudioModeAsync, createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

// Check if createAudioPlayer exists
console.log('[AudioService] createAudioPlayer imported as:', typeof createAudioPlayer, createAudioPlayer?.name);

type SoundFile = 'ding' | 'bell';

class AudioService {
  private playersPool: AudioPlayer[] = [];
  private isInitialized = false;
  private readonly MAX_POOLED_PLAYERS = 3;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[AudioService.initialize] starting');
      await setAudioModeAsync({ playsInSilentMode: true });
      this.isInitialized = true;
      console.log('[AudioService.initialize] complete');
    } catch (error) {
      console.error('Failed to initialize audio service:', error);
    }
  }

  async play(soundFile: SoundFile, volume: number = 1.0): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('[AudioService.play] starting for:', soundFile, 'volume:', volume);
      const soundAsset = soundFile === 'bell'
        ? require('../../assets/audio/bell.mp3')
        : require('../../assets/audio/ding.mp3');

      console.log('[AudioService.play] soundAsset loaded:', typeof soundAsset, soundAsset);

      // Create a new player for each sound
      console.log('[AudioService.play] calling createAudioPlayer with:', soundAsset);
      const player = createAudioPlayer(soundAsset);
      console.log('[AudioService.play] player created:', typeof player, player);
      console.log('[AudioService.play] player methods/props:', Object.getOwnPropertyNames(Object.getPrototypeOf(player)));

      player.volume = Math.max(0, Math.min(1, volume));
      console.log('[AudioService.play] volume set to:', player.volume);
      console.log('[AudioService.play] player status after volume set:', player);

      // Keep player references to prevent garbage collection during playback
      this.playersPool.push(player);
      if (this.playersPool.length > this.MAX_POOLED_PLAYERS) {
        this.playersPool.shift();
      }
      console.log('[AudioService.play] pool size:', this.playersPool.length);
      console.log('[AudioService.play] player.isLoaded:', player.isLoaded);
      console.log('[AudioService.play] player.playing:', player.playing);
      console.log('[AudioService.play] player.muted:', player.muted);

      console.log('[AudioService.play] calling player.play()');
      player.play();  // Note: play() returns void, not Promise
      console.log('[AudioService.play] player.play() called');
      console.log('[AudioService.play] after play - player.playing:', player.playing);
    } catch (error) {
      console.error(`[AudioService.play] Failed to play sound '${soundFile}':`, error);
    }
  }

  async stop(): Promise<void> {
    try {
      // Stop all players in the pool
      for (const player of this.playersPool) {
        try {
          await player.pause();
        } catch {
          // ignore individual player pause errors
        }
      }
    } catch (error) {
      console.error('Failed to stop audio:', error);
    }
  }

  setVolume(volume: number): void {
    for (const player of this.playersPool) {
      player.volume = Math.max(0, Math.min(1, volume));
    }
  }
}

export const audioService = new AudioService();
