import { VideoStrategy } from './video.strategy';

const mockAi = { evaluateText: jest.fn() } as any;

describe('VideoStrategy', () => {
  const strategy = new VideoStrategy(mockAi);

  beforeEach(() => jest.clearAllMocks());

  it('EXACT mode: CORRECT on case-insensitive match', async () => {
    const result = await strategy.verify(
      { videoUrl: 'x', mode: 'EXACT', expectedAnswer: 'BACH' },
      { answer: 'bach' },
    );
    expect(result.status).toBe('CORRECT');
  });

  it('AI mode: PARTIAL when AI score in (0, threshold)', async () => {
    mockAi.evaluateText.mockResolvedValue({ score: 0.3, feedback: 'partial' });
    const result = await strategy.verify(
      { videoUrl: 'x', mode: 'AI', prompt: 'q', threshold: 0.7 },
      { answer: 'half right' },
    );
    expect(result.status).toBe('PARTIAL');
  });
});
