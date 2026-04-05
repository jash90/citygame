import { AudioAiStrategy } from './audio-ai.strategy';

describe('AudioAiStrategy', () => {
  let strategy: AudioAiStrategy;
  let mockAiService: any;

  beforeEach(() => {
    mockAiService = {
      evaluateAudio: jest.fn(),
    };
    strategy = new AudioAiStrategy(mockAiService);
  });

  it('should return CORRECT when score >= threshold', async () => {
    mockAiService.evaluateAudio.mockResolvedValue({
      score: 0.8,
      feedback: 'Good recording',
      reasoning: 'Matches criteria',
    });

    const result = await strategy.verify(
      { prompt: 'Describe the location', threshold: 0.6 },
      { transcription: 'This is a beautiful square...' },
    );

    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(0.8);
  });

  it('should return INCORRECT when transcription is missing', async () => {
    const result = await strategy.verify(
      { prompt: 'Describe the location', threshold: 0.6 },
      {},
    );

    expect(result.status).toBe('INCORRECT');
    expect(result.score).toBe(0);
    expect(mockAiService.evaluateAudio).not.toHaveBeenCalled();
  });

  it('should return PARTIAL when 0 < score < threshold', async () => {
    mockAiService.evaluateAudio.mockResolvedValue({
      score: 0.4,
      feedback: 'Incomplete',
      reasoning: 'Missing details',
    });

    const result = await strategy.verify(
      { prompt: 'Describe', threshold: 0.6 },
      { transcription: 'Short...' },
    );

    expect(result.status).toBe('PARTIAL');
  });
});
