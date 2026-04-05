import * as bcrypt from 'bcryptjs';
import { TextExactStrategy } from './text-exact.strategy';

describe('TextExactStrategy', () => {
  let strategy: TextExactStrategy;

  beforeEach(() => {
    strategy = new TextExactStrategy();
  });

  it('should return CORRECT for matching answer', async () => {
    const hash = await bcrypt.hash('zapiekanka', 10);
    const result = await strategy.verify(
      { answerHash: hash },
      { answer: 'Zapiekanka' },
    );
    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(1.0);
  });

  it('should normalise answer to lowercase and trim', async () => {
    const hash = await bcrypt.hash('wisłok', 10);
    const result = await strategy.verify(
      { answerHash: hash },
      { answer: '  Wisłok  ' },
    );
    expect(result.status).toBe('CORRECT');
  });

  it('should return INCORRECT for wrong answer', async () => {
    const hash = await bcrypt.hash('correct', 10);
    const result = await strategy.verify(
      { answerHash: hash },
      { answer: 'wrong' },
    );
    expect(result.status).toBe('INCORRECT');
    expect(result.score).toBe(0);
  });

  it('should return ERROR when answer is missing', async () => {
    const hash = await bcrypt.hash('test', 10);
    const result = await strategy.verify({ answerHash: hash }, {});
    expect(result.status).toBe('ERROR');
  });

  it('should return ERROR when answerHash is missing', async () => {
    const result = await strategy.verify({}, { answer: 'test' });
    expect(result.status).toBe('ERROR');
  });
});
