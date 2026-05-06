import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiCredentialsService } from './ai-credentials.service';
import { AiGameBlueprintService } from './ai-game-blueprint.service';
import { GameFlowType } from '@citygame/shared';
import type { BlueprintInput, StoryBible } from '@citygame/shared';

// ── Stage-routing mock for chat.completions.create ────────────────────────────
//
// The blueprint pipeline now runs five distinct structured-output calls
// (storyBible → outline → singleTask × N → transitions → endings). The mock
// dispatches each call by its `response_format.json_schema.name` and returns a
// canned, schema-valid payload. Each test reuses the dispatcher and only
// overrides the stages it cares about.

type CompletionRequest = {
  response_format?: {
    json_schema?: { name?: string };
  };
};

const STORY_BIBLE_PAYLOAD: StoryBible = {
  protagonistRole: 'młody kronikarz',
  questGiver: {
    name: 'Mistrz Wojciech',
    role: 'starszy bibliotekarz',
    motivation: 'odzyskać zaginiony tom',
    voiceTrait: 'mówi powoli, z łacińskimi wtrętami',
  },
  antagonist: null,
  macguffin: { name: 'Stary tom', significance: 'klucz do tajemnicy miasta' },
  centralMystery: 'Co skrywa zaginiony tom z biblioteki katedralnej?',
  toneAnchors: ['melancholijny', 'tajemniczy', 'staroświecki'],
  thematicMotifs: ['stare księgi', 'gasnące świece'],
  recurringCharacters: [],
  endingsSkeleton: [
    {
      label: 'default_resolution',
      summary: 'Bohater odnajduje tom i poznaje jego treść.',
      requiredCluesPlanted: ['rękopis ujawnia zapomniane imię'],
    },
  ],
};

const OUTLINE_PAYLOAD = {
  title: 'Sekret zaginionego tomu',
  description: 'Trzyetapowa wędrówka po Krakowie śladem zaginionego rękopisu.',
  city: 'Kraków',
  flowType: 'LINEAR' as const,
  theme: 'Średniowieczne legendy',
  prologue: 'Mistrz Wojciech wręcza ci pierwszy klucz.',
  pois: [
    {
      index: 1,
      name: 'Brama katedry',
      latitude: 50.0541,
      longitude: 19.9354,
      role: 'START' as const,
      summary: 'Pierwszy ślad.',
      narrativeBeat: 'hook' as const,
      recurringCharacterIds: [],
      plantedClues: [],
    },
    {
      index: 2,
      name: 'Skryptorium',
      latitude: 50.055,
      longitude: 19.937,
      role: 'PUZZLE' as const,
      summary: 'Rękopisy ujawniają zapomniane imię.',
      narrativeBeat: 'midpoint' as const,
      recurringCharacterIds: [],
      plantedClues: ['rękopis ujawnia zapomniane imię'],
    },
    {
      index: 3,
      name: 'Krypta',
      latitude: 50.056,
      longitude: 19.939,
      role: 'FINAL' as const,
      summary: 'Bohater otwiera tom.',
      narrativeBeat: 'resolution' as const,
      recurringCharacterIds: [],
      plantedClues: [],
    },
  ],
  endingHints: [
    {
      slug: 'default_resolution',
      title: 'Spokojny świt',
      flavour: 'Tom otwarty.',
    },
  ],
};

function mockTask(index: number) {
  return {
    task: {
      index,
      title: `Zadanie ${index}`,
      description:
        'Stary kronikarz prowadzi cię między zapomnianymi rękopisami i gasnącymi świecami.',
      type: 'TEXT_EXACT',
      unlockMethod: 'NONE',
      latitude: 50.054 + index * 0.001,
      longitude: 19.935 + index * 0.001,
      expectedAnswer: `odpowiedź${index}`,
      caseSensitive: false,
      maxPoints: 100,
      hints: [{ content: 'Spójrz uważnie na inskrypcję.', pointPenalty: 10 }],
      storyContext: {
        characterName: 'Mistrz Wojciech',
        locationIntro: 'Cisza biblioteki obejmuje cię szczelnie.',
        taskNarrative: 'Bibliotekarz wskazuje regał z pożółkłymi tomami.',
        clueRevealed:
          index === 2
            ? 'rękopis ujawnia zapomniane imię'
            : 'wskazówka prowadzi cię dalej',
      },
    },
  };
}

const TRANSITIONS_PAYLOAD = {
  transitions: [
    { fromTaskIndex: null, toTaskIndex: 1 },
    { fromTaskIndex: 1, toTaskIndex: 2 },
    { fromTaskIndex: 2, toTaskIndex: 3 },
  ],
};

const ENDINGS_PAYLOAD = {
  endings: [
    {
      slug: 'default_resolution',
      title: 'Spokojny świt',
      description:
        'Otwarcie tomu kończy historię w sposób, jaki przewidział Mistrz Wojciech.',
      condition: { type: 'DEFAULT' },
      isDefault: true,
    },
  ],
};

function makeMockClient() {
  const create = jest.fn(async (req: CompletionRequest) => {
    const name = req.response_format?.json_schema?.name;
    let payload: unknown;
    switch (name) {
      case 'storyBible':
        payload = STORY_BIBLE_PAYLOAD;
        break;
      case 'gameOutline':
        payload = OUTLINE_PAYLOAD;
        break;
      case 'singleTask': {
        // The prompt embeds `'index' equals N` — extract the integer so each
        // parallel call returns the right task index. The apostrophe between
        // `index` and `equals` is part of the literal phrasing in the prompt.
        const messages = (req as { messages?: { content?: string }[] }).messages;
        const userContent = messages?.[messages.length - 1]?.content ?? '';
        const match = userContent.match(/equals\s+(\d+)/);
        const idx = match ? parseInt(match[1], 10) : 1;
        payload = mockTask(idx);
        break;
      }
      case 'gameTransitions':
        payload = TRANSITIONS_PAYLOAD;
        break;
      case 'gameEndings':
        payload = ENDINGS_PAYLOAD;
        break;
      default:
        throw new Error(`Unexpected json_schema name: ${name}`);
    }
    return {
      choices: [
        { message: { content: JSON.stringify(payload) }, finish_reason: 'stop' },
      ],
    };
  });
  return { create };
}

describe('AiGameBlueprintService', () => {
  let service: AiGameBlueprintService;
  let mockCreate: jest.Mock;

  const baseInput: BlueprintInput = {
    city: 'Kraków',
    theme: 'Średniowieczne legendy',
    flowType: GameFlowType.LINEAR,
    taskCount: 3,
    durationMinutes: 60,
    difficulty: 'MEDIUM',
    language: 'pl',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Disable the real Nominatim HTTP call — the service tolerates `null` and
    // falls back to the unanchored prompt path.
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never;
    const mockClient = makeMockClient();
    mockCreate = mockClient.create;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiGameBlueprintService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(null) },
        },
        {
          provide: AiCredentialsService,
          useValue: {
            getClient: () => ({ chat: { completions: mockClient } }),
            getModelFor: () => 'anthropic/claude-sonnet-4-5',
            getUseWebSearch: () => false,
          },
        },
      ],
    }).compile();
    service = module.get(AiGameBlueprintService);
  });

  describe('generateStoryBible', () => {
    it('returns a Zod-validated StoryBible parsed from the model response', async () => {
      const bible = await service.generateStoryBible(baseInput);
      expect(bible.protagonistRole).toBe('młody kronikarz');
      expect(bible.endingsSkeleton).toHaveLength(1);
      expect(bible.toneAnchors).toContain('melancholijny');
      // The first call must hit the storyBible structured format.
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const firstCall = mockCreate.mock.calls[0][0];
      expect(firstCall.response_format.json_schema.name).toBe('storyBible');
    });
  });

  describe('generateGameBlueprint', () => {
    it('runs storyBible FIRST and propagates it onto the final blueprint', async () => {
      const blueprint = await service.generateGameBlueprint(baseInput);

      // Pipeline order: 1 bible + 1 outline + 3 tasks + 1 transitions + 1 endings = 7
      expect(mockCreate).toHaveBeenCalledTimes(7);
      const stageNames = mockCreate.mock.calls.map(
        (c) => (c[0] as CompletionRequest).response_format?.json_schema?.name,
      );
      expect(stageNames[0]).toBe('storyBible');
      expect(stageNames[1]).toBe('gameOutline');
      // Tasks may be in any order due to Promise.all; just verify count.
      const taskStages = stageNames.filter((n) => n === 'singleTask');
      expect(taskStages).toHaveLength(3);
      expect(stageNames).toContain('gameTransitions');
      expect(stageNames).toContain('gameEndings');

      expect(blueprint.storyBible).toBeDefined();
      expect(blueprint.storyBible?.protagonistRole).toBe('młody kronikarz');
      expect(blueprint.tasks).toHaveLength(3);
      expect(blueprint.endings).toHaveLength(1);
    });

    it('embeds the bible JSON inside subsequent prompts (per-POI generation)', async () => {
      await service.generateGameBlueprint(baseInput);
      const taskCall = mockCreate.mock.calls.find(
        (c) =>
          (c[0] as CompletionRequest).response_format?.json_schema?.name ===
          'singleTask',
      );
      expect(taskCall).toBeDefined();
      const userMessage = (
        taskCall![0] as { messages: { role: string; content: string }[] }
      ).messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('STORY BIBLE');
      expect(userMessage?.content).toContain('Mistrz Wojciech');
    });
  });
});
