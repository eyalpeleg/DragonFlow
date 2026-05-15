/* eslint-disable import/first */
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    volume: 1,
  })),
}));

import { createAudioPlayer } from 'expo-audio';
import { audioService } from '../audioService';

const mockCreatePlayer = createAudioPlayer as jest.Mock;
const getPool = () => (audioService as unknown as { playersPool: unknown[] }).playersPool;

describe('audioService', () => {
  beforeEach(() => {
    mockCreatePlayer.mockClear();
    mockCreatePlayer.mockImplementation(() => ({
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn().mockResolvedValue(undefined),
      volume: 1,
    }));
    // Reset internal pool between tests
    getPool().length = 0;
  });

  it('retains the created player in the pool after play() is called (regression guard)', async () => {
    await audioService.play('ding', 1.0);
    const pool = getPool();
    const createdPlayer = mockCreatePlayer.mock.results[0].value;

    expect(mockCreatePlayer).toHaveBeenCalledTimes(1);
    expect(createdPlayer.play).toHaveBeenCalledTimes(1);
    expect(pool).toContain(createdPlayer);
  });

  it('keeps an in-flight player in the pool while subsequent plays happen', async () => {
    let resolveFirst: () => void = () => {};
    const firstPlayerPlay = jest.fn(() => new Promise<void>((r) => { resolveFirst = r; }));
    mockCreatePlayer.mockImplementationOnce(() => ({
      play: firstPlayerPlay,
      pause: jest.fn().mockResolvedValue(undefined),
      volume: 1,
    }));

    const firstPlay = audioService.play('ding', 1.0);
    await audioService.play('bell', 1.0);
    await audioService.play('ding', 1.0);

    const pool = getPool();
    const firstPlayer = mockCreatePlayer.mock.results[0].value;
    expect(pool).toContain(firstPlayer);
    expect(firstPlayerPlay).toHaveBeenCalled();

    resolveFirst();
    await firstPlay;
  });

  it('loads the correct mp3 asset for each sound', async () => {
    await audioService.play('ding', 1.0);
    await audioService.play('bell', 1.0);

    const dingAsset = mockCreatePlayer.mock.calls[0][0];
    const bellAsset = mockCreatePlayer.mock.calls[1][0];
    expect(dingAsset).toBeDefined();
    expect(bellAsset).toBeDefined();
    expect(mockCreatePlayer).toHaveBeenCalledTimes(2);
  });

  it('clamps volume to [0, 1] before setting on the player', async () => {
    await audioService.play('ding', 1.5);
    expect(mockCreatePlayer.mock.results[0].value.volume).toBe(1);

    await audioService.play('ding', -0.5);
    expect(mockCreatePlayer.mock.results[1].value.volume).toBe(0);

    await audioService.play('ding', 0.42);
    expect(mockCreatePlayer.mock.results[2].value.volume).toBe(0.42);
  });

  it('caps the pool at MAX_POOLED_PLAYERS to avoid leaking references', async () => {
    for (let i = 0; i < 10; i++) {
      await audioService.play('ding', 1.0);
    }
    const pool = getPool();
    expect(pool.length).toBeLessThanOrEqual(3);
  });
});
