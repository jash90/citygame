import { PhotoAiStrategy } from './photo-ai.strategy';

describe('PhotoAiStrategy', () => {
  let strategy: PhotoAiStrategy;
  let mockAiService: any;
  let mockStorageService: any;

  beforeEach(() => {
    mockAiService = {
      evaluatePhoto: jest.fn(),
    };
    mockStorageService = {};
    strategy = new PhotoAiStrategy(mockAiService, mockStorageService);
  });

  it('should return CORRECT when score >= threshold', async () => {
    mockAiService.evaluatePhoto.mockResolvedValue({
      score: 0.85,
      feedback: 'Great photo!',
      reasoning: 'Matches criteria',
    });

    const result = await strategy.verify(
      { prompt: 'Show a church', threshold: 0.6 },
      { imageUrl: 'https://example.com/img.jpg' },
    );

    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(0.85);
    expect(result.aiResult).toBeDefined();
  });

  it('should return PARTIAL when 0 < score < threshold', async () => {
    mockAiService.evaluatePhoto.mockResolvedValue({
      score: 0.4,
      feedback: 'Partially matches',
      reasoning: 'Some elements present',
    });

    const result = await strategy.verify(
      { prompt: 'Show a church', threshold: 0.6 },
      { imageUrl: 'https://example.com/img.jpg' },
    );

    expect(result.status).toBe('PARTIAL');
    expect(result.score).toBe(0.4);
  });

  it('should return INCORRECT when score is 0', async () => {
    mockAiService.evaluatePhoto.mockResolvedValue({
      score: 0,
      feedback: 'Does not match',
      reasoning: 'No matching elements',
    });

    const result = await strategy.verify(
      { prompt: 'Show a church', threshold: 0.6 },
      { imageUrl: 'https://example.com/img.jpg' },
    );

    expect(result.status).toBe('INCORRECT');
  });

  it('should return INCORRECT when imageUrl is missing', async () => {
    const result = await strategy.verify(
      { prompt: 'Show a church', threshold: 0.6 },
      {},
    );

    expect(result.status).toBe('INCORRECT');
    expect(result.score).toBe(0);
    expect(mockAiService.evaluatePhoto).not.toHaveBeenCalled();
  });

  it('should use default threshold of 0.7 when not specified', async () => {
    mockAiService.evaluatePhoto.mockResolvedValue({
      score: 0.65,
      feedback: 'Close',
      reasoning: 'Almost',
    });

    const result = await strategy.verify(
      { prompt: 'Show a church' },
      { imageUrl: 'https://example.com/img.jpg' },
    );

    expect(result.status).toBe('PARTIAL');
  });
});
