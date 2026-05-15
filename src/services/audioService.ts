import { setAudioModeAsync, createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

type SoundFile = 'ding' | 'bell';

class AudioService {
  private playersPool: AudioPlayer[] = [];
  private isInitialized = false;
  private readonly MAX_POOLED_PLAYERS = 3;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await setAudioModeAsync({ playsInSilentMode: true });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audio service:', error);
    }
  }

  async play(soundFile: SoundFile, volume: number = 1.0): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const soundAsset = soundFile === 'bell'
        ? require('../../assets/audio/bell.mp3')
        : require('../../assets/audio/ding.mp3');

      // Create a new player for each sound
      const player = createAudioPlayer(soundAsset);
      player.volume = Math.max(0, Math.min(1, volume));

      // Keep player references to prevent garbage collection during playback
      this.playersPool.push(player);
      if (this.playersPool.length > this.MAX_POOLED_PLAYERS) {
        this.playersPool.shift();
      }

      await player.play();
    } catch (error) {
      console.error(`Failed to play sound '${soundFile}':`, error);
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
