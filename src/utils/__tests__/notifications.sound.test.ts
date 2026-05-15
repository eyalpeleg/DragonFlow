/* eslint-disable import/first */
jest.mock('../../services/audioService', () => ({
  audioService: {
    play: jest.fn().mockResolvedValue(undefined),
    initialize: jest.fn().mockResolvedValue(undefined),
  },
}));

import { playAppSound, playPreviewSound } from '../notifications';
import { audioService } from '../../services/audioService';

const mockPlay = audioService.play as jest.Mock;

describe('notifications sound integration', () => {
  beforeEach(() => {
    mockPlay.mockClear();
  });

  it('playAppSound delegates to audioService.play with same args', async () => {
    await playAppSound('ding', 0.5);
    expect(mockPlay).toHaveBeenCalledWith('ding', 0.5);

    await playAppSound('bell', 0.8);
    expect(mockPlay).toHaveBeenCalledWith('bell', 0.8);
  });

  it('playPreviewSound with preference="Disabled" does NOT call audioService.play', async () => {
    await playPreviewSound('ding', 'Disabled', 1.0);
    expect(mockPlay).not.toHaveBeenCalled();

    await playPreviewSound('bell', 'AppSound', 0.7);
    expect(mockPlay).toHaveBeenCalledWith('bell', 0.7);
  });
});
