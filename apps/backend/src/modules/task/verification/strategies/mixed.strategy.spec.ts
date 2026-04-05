import { MixedStrategy } from './mixed.strategy';
import { VerificationResult } from './verification-strategy.interface';

describe('MixedStrategy', () => {
  let strategy: MixedStrategy;
  let mockVerificationService: any;

  beforeEach(() => {
    mockVerificationService = {
      verifyStep: jest.fn(),
    };
    strategy = new MixedStrategy(mockVerificationService);
  });

  it('should return CORRECT when all steps pass', async () => {
    const correctResult: VerificationResult = {
      status: 'CORRECT',
      score: 1.0,
      feedback: 'OK',
    };
    mockVerificationService.verifyStep.mockResolvedValue(correctResult);

    const result = await strategy.verify(
      {
        steps: [
          { type: 'GPS_REACH', targetLat: 50 },
          { type: 'TEXT_EXACT', answerHash: 'h' },
        ],
      },
      {
        steps: [
          { latitude: 50, longitude: 19 },
          { answer: 'test' },
        ],
      },
    );

    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(1.0);
    expect(mockVerificationService.verifyStep).toHaveBeenCalledTimes(2);
  });

  it('should return PARTIAL when some steps pass', async () => {
    mockVerificationService.verifyStep
      .mockResolvedValueOnce({ status: 'CORRECT', score: 1.0, feedback: 'OK' })
      .mockResolvedValueOnce({ status: 'INCORRECT', score: 0, feedback: 'Wrong' });

    const result = await strategy.verify(
      { steps: [{ type: 'GPS_REACH' }, { type: 'TEXT_EXACT' }] },
      { steps: [{ latitude: 50 }, { answer: 'wrong' }] },
    );

    expect(result.status).toBe('PARTIAL');
    expect(result.score).toBe(0.5);
  });

  it('should return INCORRECT when no steps pass', async () => {
    mockVerificationService.verifyStep.mockResolvedValue({
      status: 'INCORRECT',
      score: 0,
      feedback: 'Wrong',
    });

    const result = await strategy.verify(
      { steps: [{ type: 'TEXT_EXACT' }] },
      { steps: [{ answer: 'wrong' }] },
    );

    expect(result.status).toBe('INCORRECT');
    expect(result.score).toBe(0);
  });

  it('should return ERROR when steps config is missing', async () => {
    const result = await strategy.verify({}, { steps: [] });
    expect(result.status).toBe('ERROR');
  });

  it('should return ERROR when step submissions are missing', async () => {
    const result = await strategy.verify({ steps: [{ type: 'GPS_REACH' }] }, {});
    expect(result.status).toBe('ERROR');
  });

  it('should handle missing step submission gracefully', async () => {
    mockVerificationService.verifyStep.mockResolvedValue({
      status: 'CORRECT',
      score: 1.0,
      feedback: 'OK',
    });

    const result = await strategy.verify(
      { steps: [{ type: 'GPS_REACH' }, { type: 'TEXT_EXACT' }] },
      { steps: [{ latitude: 50 }] }, // only 1 of 2 submissions
    );

    // First step processed, second gets INCORRECT for missing submission
    expect(result.status).toBe('PARTIAL');
    expect(mockVerificationService.verifyStep).toHaveBeenCalledTimes(1);
  });
});
