import { createHash } from 'crypto';
import { QrScanStrategy } from './qr-scan.strategy';

describe('QrScanStrategy', () => {
  let strategy: QrScanStrategy;

  beforeEach(() => {
    strategy = new QrScanStrategy();
  });

  function makeHash(code: string): string {
    return `sha256:${createHash('sha256').update(code).digest('hex')}`;
  }

  it('should return CORRECT for matching QR code', async () => {
    const code = 'KOSCIOL_MARIACKI_HEJNAL';
    const hash = makeHash(code);
    const result = await strategy.verify(
      { expectedHash: hash },
      { code },
    );
    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(1.0);
  });

  it('should return INCORRECT for wrong QR code', async () => {
    const hash = makeHash('CORRECT_CODE');
    const result = await strategy.verify(
      { expectedHash: hash },
      { code: 'WRONG_CODE' },
    );
    expect(result.status).toBe('INCORRECT');
    expect(result.score).toBe(0);
  });

  it('should return ERROR when code is missing', async () => {
    const result = await strategy.verify(
      { expectedHash: 'sha256:abc' },
      {},
    );
    expect(result.status).toBe('ERROR');
  });

  it('should return ERROR when expectedHash is missing', async () => {
    const result = await strategy.verify({}, { code: 'some_code' });
    expect(result.status).toBe('ERROR');
  });
});
