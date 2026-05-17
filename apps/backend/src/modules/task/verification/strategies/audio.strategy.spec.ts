import { AudioStrategy } from './audio.strategy';

const mockAi = {
  evaluateText: jest.fn(),
} as any;

describe('AudioStrategy', () => {
  const strategy = new AudioStrategy(mockAi);

  beforeEach(() => jest.clearAllMocks());

  it('EXACT mode: returns CORRECT when answer matches expectedAnswer (case/whitespace insensitive)', async () => {
    const result = await strategy.verify(
      { audioUrl: 'https://x/y.m4a', mode: 'EXACT', expectedAnswer: 'pies' },
      { answer: '  Pies ' },
    );
    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(1);
  });

  it('EXACT mode: returns INCORRECT when answer differs', async () => {
    const result = await strategy.verify(
      { audioUrl: 'x', mode: 'EXACT', expectedAnswer: 'pies' },
      { answer: 'kot' },
    );
    expect(result.status).toBe('INCORRECT');
  });

  it('EXACT is default mode when mode is missing', async () => {
    const result = await strategy.verify(
      { audioUrl: 'x', expectedAnswer: 'pies' },
      { answer: 'pies' },
    );
    expect(result.status).toBe('CORRECT');
  });

  it('AI mode: delegates to AiService.evaluateText and maps score', async () => {
    mockAi.evaluateText.mockResolvedValue({ score: 0.85, feedback: 'Good' });
    const result = await strategy.verify(
      { audioUrl: 'x', mode: 'AI', prompt: 'Is this a dog sound?', threshold: 0.7 },
      { answer: 'Maybe a husky' },
    );
    expect(mockAi.evaluateText).toHaveBeenCalledWith('Maybe a husky', 'Is this a dog sound?', 0.7);
    expect(result.status).toBe('CORRECT');
    expect(result.score).toBe(0.85);
  });

  it('AI mode: PARTIAL when 0 < score < threshold', async () => {
    mockAi.evaluateText.mockResolvedValue({ score: 0.4, feedback: 'partly' });
    const result = await strategy.verify(
      { audioUrl: 'x', mode: 'AI', prompt: 'q', threshold: 0.7 },
      { answer: 'meh' },
    );
    expect(result.status).toBe('PARTIAL');
  });

  it('returns INCORRECT when answer is empty', async () => {
    const result = await strategy.verify(
      { audioUrl: 'x', mode: 'EXACT', expectedAnswer: 'pies' },
      { answer: '   ' },
    );
    expect(result.status).toBe('INCORRECT');
  });

  it('returns ERROR in EXACT mode when expectedAnswer is missing', async () => {
    const result = await strategy.verify(
      { audioUrl: 'x', mode: 'EXACT' },
      { answer: 'pies' },
    );
    expect(result.status).toBe('ERROR');
  });
});
