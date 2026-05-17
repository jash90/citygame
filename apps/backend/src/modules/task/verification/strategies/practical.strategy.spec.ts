import { PracticalStrategy } from './practical.strategy';

describe('PracticalStrategy', () => {
  const strategy = new PracticalStrategy();

  it('always returns PENDING with empty submission', async () => {
    const result = await strategy.verify({}, {});
    expect(result.status).toBe('PENDING');
    expect(result.score).toBe(0);
  });

  it('returns PENDING regardless of submission payload', async () => {
    const result = await strategy.verify(
      { criteria: 'Has to do 20 push-ups' },
      { requestedAt: '2026-05-17T16:45:00.000Z' },
    );
    expect(result.status).toBe('PENDING');
  });
});
