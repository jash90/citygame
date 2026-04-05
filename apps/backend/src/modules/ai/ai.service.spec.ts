import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

// ── Mock Anthropic SDK ────────────────────────────────────────────────────────

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

const mockConfig = {
  getOrThrow: jest.fn().mockReturnValue('sk-ant-test-key'),
  get: jest.fn().mockImplementation((key: string, defaultVal?: unknown) => {
    const values: Record<string, unknown> = {
      ANTHROPIC_MODEL: 'claude-sonnet-4-5',
      AI_TIMEOUT_MS: 30000,
    };
    return values[key] ?? defaultVal;
  }),
};

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(AiService);
  });

  describe('evaluateText', () => {
    it('returns parsed score and feedback for valid response', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              score: 0.9,
              feedback: 'Great answer!',
              reasoning: 'Matches criteria',
            }),
          },
        ],
      });

      const result = await service.evaluateText('Paris', 'What is the capital of France?', 0.7);

      expect(result.score).toBe(0.9);
      expect(result.feedback).toBe('Great answer!');
      expect(result.reasoning).toBe('Matches criteria');
    });

    it('clamps score to [0, 1] range', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ score: 1.5, feedback: 'Over', reasoning: '' }),
          },
        ],
      });

      const result = await service.evaluateText('answer', 'prompt', 0.5);
      expect(result.score).toBe(1);
    });

    it('returns zero score on API failure', async () => {
      mockCreate.mockRejectedValue(new Error('API timeout'));

      const result = await service.evaluateText('answer', 'prompt', 0.5);

      expect(result.score).toBe(0);
      expect(result.feedback).toContain('Could not evaluate');
    });

    it('returns zero score on unparseable response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'not json' }],
      });

      const result = await service.evaluateText('answer', 'prompt', 0.5);
      expect(result.score).toBe(0);
      expect(result.feedback).toContain('Could not parse');
    });
  });

  describe('evaluateAudio', () => {
    it('delegates to evaluateText with transcription prefix', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ score: 0.8, feedback: 'Good', reasoning: '' }),
          },
        ],
      });

      const result = await service.evaluateAudio('hello world', 'check greeting', 0.5);

      expect(result.score).toBe(0.8);
      // Verify the message sent to API includes the transcription prefix
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('[Audio transcription]'),
            }),
          ]),
        }),
      );
    });
  });

  describe('generateTaskDescription', () => {
    it('returns generated description text', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Find the hidden monument near the river.' }],
      });

      const result = await service.generateTaskDescription('Find Monument', 'GPS_REACH', 'Warsaw');
      expect(result).toBe('Find the hidden monument near the river.');
    });

    it('returns empty string on failure', async () => {
      mockCreate.mockRejectedValue(new Error('fail'));

      const result = await service.generateTaskDescription('T', 'GPS_REACH', 'Warsaw');
      expect(result).toBe('');
    });
  });

  describe('generateHints', () => {
    it('returns array of hint strings', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '["Hint 1", "Hint 2", "Hint 3"]' }],
      });

      const result = await service.generateHints('Find the monument', 3);

      expect(result).toEqual(['Hint 1', 'Hint 2', 'Hint 3']);
    });

    it('returns empty array on failure', async () => {
      mockCreate.mockRejectedValue(new Error('fail'));

      const result = await service.generateHints('description');
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '"just a string"' }],
      });

      const result = await service.generateHints('description');
      expect(result).toEqual([]);
    });
  });

  describe('generateAIPrompt', () => {
    it('returns verification prompt text', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Check if the photo shows a cathedral.' }],
      });

      const result = await service.generateAIPrompt('PHOTO_AI', 'Take a photo of the cathedral');
      expect(result).toBe('Check if the photo shows a cathedral.');
    });

    it('returns empty string on failure', async () => {
      mockCreate.mockRejectedValue(new Error('fail'));

      const result = await service.generateAIPrompt('PHOTO_AI', 'desc');
      expect(result).toBe('');
    });
  });
});
