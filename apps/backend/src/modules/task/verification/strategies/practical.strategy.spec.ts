import { PracticalStrategy } from './practical.strategy';

describe('PracticalStrategy', () => {
  const strategy = new PracticalStrategy();

  it('returns PENDING when description is sufficiently long', async () => {
    const result = await strategy.verify(
      { criteria: 'Has to mention X and Y' },
      { description: 'Spotkałem się z mieszkańcem i nagrałem historię.' },
    );
    expect(result.status).toBe('PENDING');
    expect(result.score).toBe(0);
  });

  it('returns INCORRECT when description is too short', async () => {
    const result = await strategy.verify({}, { description: 'krótko' });
    expect(result.status).toBe('INCORRECT');
  });

  it('returns INCORRECT when description is missing', async () => {
    const result = await strategy.verify({}, {});
    expect(result.status).toBe('INCORRECT');
  });
});
