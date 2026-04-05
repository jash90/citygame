import * as bcrypt from 'bcryptjs';
import { CipherStrategy } from './cipher.strategy';

describe('CipherStrategy', () => {
  let strategy: CipherStrategy;

  beforeEach(() => {
    strategy = new CipherStrategy();
  });

  it('should return CORRECT for matching answer', async () => {
    const hash = await bcrypt.hash('wisłok', 10);
    const result = await strategy.verify(
      { answerHash: hash },
      { answer: 'Wisłok' },
    );
    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(1.0);
    expect(result.feedback).toContain('rozszyfrowany');
  });

  it('should return INCORRECT with cipher hint when provided', async () => {
    const hash = await bcrypt.hash('secret', 10);
    const result = await strategy.verify(
      { answerHash: hash, cipherHint: 'First letters...' },
      { answer: 'wrong' },
    );
    expect(result.status).toBe('INCORRECT');
    expect(result.feedback).toContain('First letters...');
  });

  it('should return INCORRECT without hint when not provided', async () => {
    const hash = await bcrypt.hash('secret', 10);
    const result = await strategy.verify(
      { answerHash: hash },
      { answer: 'wrong' },
    );
    expect(result.status).toBe('INCORRECT');
    expect(result.feedback).not.toContain('Wskazówka');
  });

  it('should return ERROR when answer is missing', async () => {
    const result = await strategy.verify({ answerHash: 'h' }, {});
    expect(result.status).toBe('ERROR');
  });

  it('should return ERROR when hash is missing', async () => {
    const result = await strategy.verify({}, { answer: 'test' });
    expect(result.status).toBe('ERROR');
  });
});
