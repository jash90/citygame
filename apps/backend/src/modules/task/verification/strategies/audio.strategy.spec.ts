import { AudioStrategy } from './audio.strategy';

describe('AudioStrategy', () => {
  const strategy = new AudioStrategy();

  it('returns CORRECT when audioUrl is present', async () => {
    const result = await strategy.verify({}, { audioUrl: 'https://x/y.m4a' });
    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(1);
  });

  it('returns INCORRECT when audioUrl is missing', async () => {
    const result = await strategy.verify({}, {});
    expect(result.status).toBe('INCORRECT');
    expect(result.score).toBe(0);
  });

  it('returns INCORRECT when audioUrl is empty', async () => {
    const result = await strategy.verify({}, { audioUrl: '   ' });
    expect(result.status).toBe('INCORRECT');
  });
});
