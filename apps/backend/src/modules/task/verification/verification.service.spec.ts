import { NotImplementedException } from '@nestjs/common';
import { TaskType } from '@prisma/client';
import { VerificationService } from './verification.service';
import { VerificationResult, VerificationStrategy } from './strategies/verification-strategy.interface';

// Mock strategies
const createMockStrategy = (result: VerificationResult): VerificationStrategy => ({
  verify: jest.fn().mockResolvedValue(result),
});

describe('VerificationService', () => {
  let service: VerificationService;
  const correctResult: VerificationResult = {
    status: 'CORRECT',
    score: 1.0,
    feedback: 'OK',
  };

  const mockQrScan = createMockStrategy(correctResult);
  const mockGpsReach = createMockStrategy(correctResult);
  const mockTextExact = createMockStrategy(correctResult);
  const mockPhotoAi = createMockStrategy(correctResult);
  const mockTextAi = createMockStrategy(correctResult);
  const mockAudioAi = createMockStrategy(correctResult);
  const mockCipher = createMockStrategy(correctResult);
  const mockMixed = createMockStrategy(correctResult);

  beforeEach(() => {
    service = new VerificationService(
      mockQrScan as any,
      mockGpsReach as any,
      mockTextExact as any,
      mockPhotoAi as any,
      mockTextAi as any,
      mockAudioAi as any,
      mockCipher as any,
      mockMixed as any,
    );
  });

  it('should dispatch to QR_SCAN strategy', async () => {
    const task = { type: TaskType.QR_SCAN, verifyConfig: { expectedHash: 'h' } } as any;
    await service.verify(task, { code: 'test' });
    expect(mockQrScan.verify).toHaveBeenCalledWith({ expectedHash: 'h' }, { code: 'test' });
  });

  it('should dispatch to GPS_REACH strategy', async () => {
    const task = { type: TaskType.GPS_REACH, verifyConfig: { targetLat: 50 } } as any;
    await service.verify(task, { latitude: 50 });
    expect(mockGpsReach.verify).toHaveBeenCalled();
  });

  it('should dispatch to TEXT_EXACT strategy', async () => {
    const task = { type: TaskType.TEXT_EXACT, verifyConfig: {} } as any;
    await service.verify(task, { answer: 'test' });
    expect(mockTextExact.verify).toHaveBeenCalled();
  });

  it('should dispatch to PHOTO_AI strategy', async () => {
    const task = { type: TaskType.PHOTO_AI, verifyConfig: {} } as any;
    await service.verify(task, {});
    expect(mockPhotoAi.verify).toHaveBeenCalled();
  });

  it('should dispatch to TEXT_AI strategy', async () => {
    const task = { type: TaskType.TEXT_AI, verifyConfig: {} } as any;
    await service.verify(task, {});
    expect(mockTextAi.verify).toHaveBeenCalled();
  });

  it('should dispatch to AUDIO_AI strategy', async () => {
    const task = { type: TaskType.AUDIO_AI, verifyConfig: {} } as any;
    await service.verify(task, {});
    expect(mockAudioAi.verify).toHaveBeenCalled();
  });

  it('should dispatch to CIPHER strategy', async () => {
    const task = { type: TaskType.CIPHER, verifyConfig: {} } as any;
    await service.verify(task, {});
    expect(mockCipher.verify).toHaveBeenCalled();
  });

  it('should dispatch to MIXED strategy', async () => {
    const task = { type: TaskType.MIXED, verifyConfig: {} } as any;
    await service.verify(task, {});
    expect(mockMixed.verify).toHaveBeenCalled();
  });

  it('should report hasStrategy correctly', () => {
    expect(service.hasStrategy(TaskType.QR_SCAN)).toBe(true);
    expect(service.hasStrategy(TaskType.GPS_REACH)).toBe(true);
    expect(service.hasStrategy(TaskType.PHOTO_AI)).toBe(true);
  });

  describe('verifyStep', () => {
    it('should delegate to the correct strategy by type string', async () => {
      await service.verifyStep('TEXT_EXACT', { answerHash: 'h' }, { answer: 'a' });
      expect(mockTextExact.verify).toHaveBeenCalledWith({ answerHash: 'h' }, { answer: 'a' });
    });

    it('should throw NotImplementedException for unknown type', async () => {
      await expect(
        service.verifyStep('UNKNOWN_TYPE', {}, {}),
      ).rejects.toThrow(NotImplementedException);
    });
  });
});
