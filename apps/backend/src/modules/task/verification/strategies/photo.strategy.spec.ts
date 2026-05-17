import { PhotoStrategy } from './photo.strategy';

const mockAi = { evaluateText: jest.fn() } as any;

describe('PhotoStrategy', () => {
  const strategy = new PhotoStrategy(mockAi);

  beforeEach(() => jest.clearAllMocks());

  it('EXACT mode: CORRECT when answer matches', async () => {
    const result = await strategy.verify(
      { imageUrl: 'x', mode: 'EXACT', expectedAnswer: 'Wawel' },
      { answer: 'wawel' },
    );
    expect(result.status).toBe('CORRECT');
  });

  it('AI mode: delegates to AiService.evaluateText', async () => {
    mockAi.evaluateText.mockResolvedValue({ score: 0.9, feedback: 'ok' });
    const result = await strategy.verify(
      { imageUrl: 'x', mode: 'AI', prompt: 'Identify the castle', threshold: 0.6 },
      { answer: 'Wawel castle in Kraków' },
    );
    expect(result.status).toBe('CORRECT');
    expect(mockAi.evaluateText).toHaveBeenCalled();
  });
});
