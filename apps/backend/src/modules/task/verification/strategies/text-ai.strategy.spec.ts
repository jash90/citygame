import { TextAiStrategy } from './text-ai.strategy';

describe('TextAiStrategy', () => {
  let strategy: TextAiStrategy;
  let mockAiService: any;

  beforeEach(() => {
    mockAiService = {
      evaluateText: jest.fn(),
    };
    strategy = new TextAiStrategy(mockAiService);
  });

  it('should return CORRECT when score >= threshold', async () => {
    mockAiService.evaluateText.mockResolvedValue({
      score: 0.9,
      feedback: 'Excellent answer',
      reasoning: 'Covers all key points',
    });

    const result = await strategy.verify(
      { prompt: 'Explain the history', threshold: 0.65 },
      { answer: 'Detailed historical explanation...' },
    );

    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(0.9);
    expect(result.aiResult).toBeDefined();
  });

  it('should return PARTIAL when 0 < score < threshold', async () => {
    mockAiService.evaluateText.mockResolvedValue({
      score: 0.3,
      feedback: 'Partially correct',
      reasoning: 'Missing key details',
    });

    const result = await strategy.verify(
      { prompt: 'Explain the history', threshold: 0.65 },
      { answer: 'Short answer' },
    );

    expect(result.status).toBe('PARTIAL');
  });

  it('should return INCORRECT when answer is missing', async () => {
    const result = await strategy.verify(
      { prompt: 'Explain the history', threshold: 0.65 },
      {},
    );

    expect(result.status).toBe('INCORRECT');
    expect(result.score).toBe(0);
    expect(mockAiService.evaluateText).not.toHaveBeenCalled();
  });

  it('should use default threshold of 0.7 when not specified', async () => {
    mockAiService.evaluateText.mockResolvedValue({
      score: 0.65,
      feedback: 'Decent answer',
      reasoning: 'OK',
    });

    const result = await strategy.verify(
      { prompt: 'Question' },
      { answer: 'Answer' },
    );

    expect(result.status).toBe('PARTIAL');
  });
});
