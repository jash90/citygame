import { PhotoStrategy } from './photo.strategy';

describe('PhotoStrategy', () => {
  const strategy = new PhotoStrategy();

  it('returns CORRECT when imageUrl is present', async () => {
    const result = await strategy.verify({}, { imageUrl: 'https://x/y.jpg' });
    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(1);
  });

  it('returns INCORRECT when imageUrl is missing', async () => {
    const result = await strategy.verify({}, {});
    expect(result.status).toBe('INCORRECT');
  });
});
