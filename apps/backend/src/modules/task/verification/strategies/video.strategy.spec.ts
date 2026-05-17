import { VideoStrategy } from './video.strategy';

describe('VideoStrategy', () => {
  const strategy = new VideoStrategy();

  it('returns CORRECT when videoUrl is present', async () => {
    const result = await strategy.verify({}, { videoUrl: 'https://x/y.mp4' });
    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(1);
  });

  it('returns INCORRECT when videoUrl is missing', async () => {
    const result = await strategy.verify({}, {});
    expect(result.status).toBe('INCORRECT');
  });
});
