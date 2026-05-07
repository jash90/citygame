import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiCredentialsService } from './ai-credentials.service';
import { AiGameBlueprintService } from './ai-game-blueprint.service';
import { GameFlowType } from '@citygame/shared';
import type {
  BlueprintInput,
  BlueprintOutline,
  StoryBible,
} from '@citygame/shared';

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

  describe('generateTaskForPoi (extracted single-POI call)', () => {
    it('returns ONE Zod-validated task for the requested POI index, with no transitions/endings calls', async () => {
      const outline = OUTLINE_PAYLOAD as unknown as BlueprintOutline;
      const poi = outline.pois.find((p) => p.index === 2)!;
      const task = await service.generateTaskForPoi(
        baseInput,
        outline,
        STORY_BIBLE_PAYLOAD,
        poi,
      );
      expect(task.index).toBe(2);
      expect(task.title).toBe('Zadanie 2');
      // Exactly one structured call — the orchestrator parallelises N of these
      // client-side, so the service method MUST be a single call.
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(
        mockCreate.mock.calls[0][0].response_format.json_schema.name,
      ).toBe('singleTask');
    });

    it('embeds the cipher assignment EXACT slug+value into the prompt when supplied', async () => {
      const outline = OUTLINE_PAYLOAD as unknown as BlueprintOutline;
      const poi = outline.pois.find((p) => p.index === 2)!;
      await service.generateTaskForPoi(baseInput, outline, STORY_BIBLE_PAYLOAD, poi, {
        role: 'CIPHER_LOCK',
        slug: 'cipher_chain_1',
        value: 'AURUM',
        kind: 'WORD',
        label: 'Klucz 1',
      });
      const messages = mockCreate.mock.calls[0][0].messages as {
        role: string;
        content: string;
      }[];
      const userContent = messages.find((m) => m.role === 'user')!.content;
      expect(userContent).toContain('cipher_chain_1');
      expect(userContent).toContain('AURUM');
      expect(userContent).toContain('CIPHER LOCK');
    });
  });

  describe('generateTransitions (extracted)', () => {
    it('returns a Zod-validated transition array from a finalised task list, with one structured call to the gameTransitions schema', async () => {
      const outline = OUTLINE_PAYLOAD as unknown as BlueprintOutline;
      const tasks = [1, 2, 3].map((i) => mockTask(i).task as never);
      const transitions = await service.generateTransitions(
        baseInput,
        outline,
        tasks,
      );
      expect(transitions).toHaveLength(3);
      expect(transitions[0]).toEqual({ fromTaskIndex: null, toTaskIndex: 1 });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(
        mockCreate.mock.calls[0][0].response_format.json_schema.name,
      ).toBe('gameTransitions');
    });
  });

  describe('planCipherChains (deterministic, exposed as Record)', () => {
    it('pairs CIPHER_SOURCE with CIPHER_LOCK by outline order and returns a Record keyed by POI index', () => {
      const outline = {
        ...OUTLINE_PAYLOAD,
        pois: [
          { ...OUTLINE_PAYLOAD.pois[0], role: 'CIPHER_SOURCE' as const },
          { ...OUTLINE_PAYLOAD.pois[1], role: 'PUZZLE' as const },
          { ...OUTLINE_PAYLOAD.pois[2], role: 'CIPHER_LOCK' as const },
        ],
      } as unknown as BlueprintOutline;
      const plan = service.planCipherChains(outline);
      expect(typeof plan).toBe('object');
      expect(Array.isArray(plan)).toBe(false);
      expect(plan[1]?.role).toBe('CIPHER_SOURCE');
      expect(plan[3]?.role).toBe('CIPHER_LOCK');
      expect(plan[1]?.slug).toBe(plan[3]?.slug);
      expect(plan[1]?.value).toBe(plan[3]?.value);
      expect(plan[2]).toBeUndefined();
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

  // ── Tier-fallback: response_format compatibility ────────────────────────────
  //
  // Some OSS-routed OpenRouter models and small open-source
  // models reject `response_format: { type: 'json_schema' }` with a 400. The
  // service auto-downgrades through `json_object` and finally plain `text`
  // (with the schema embedded in the prompt). The detected tier is cached
  // per-model so subsequent stages skip the doomed tier entirely.

  describe('response_format tier fallback', () => {
    function makeUnsupportedError() {
      const err = new Error(
        'Unsupported value for response_format: json_schema is not supported by this model',
      );
      (err as Error & { status: number }).status = 400;
      return err;
    }

    it('downgrades to json_object on first call when json_schema is rejected', async () => {
      let firstCall = true;
      const create = jest.fn(async (req: CompletionRequest) => {
        if (firstCall && req.response_format?.json_schema) {
          firstCall = false;
          throw makeUnsupportedError();
        }
        // Hand off to a name-aware dispatcher that also handles the
        // downgraded `json_object` case (which strips the `json_schema.name`
        // off the wire — the name still lives inside the prompt addendum).
        return tierAwareDispatch(req);
      });

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
              getClient: () => ({ chat: { completions: { create } } }),
              getModelFor: () => 'deepseek-v4-pro',
              getUseWebSearch: () => false,
              onProviderChange: () => () => undefined,
            },
          },
        ],
      }).compile();
      const localService = module.get(AiGameBlueprintService);

      const bible = await localService.generateStoryBible(baseInput);
      expect(bible.protagonistRole).toBe('młody kronikarz');

      // Two calls total: one rejected json_schema attempt + one successful
      // json_object retry on the SAME stage — no duplicate request beyond that.
      expect(create).toHaveBeenCalledTimes(2);
      const firstReq = create.mock.calls[0][0] as CompletionRequest & {
        response_format?: { type?: string };
      };
      const secondReq = create.mock.calls[1][0] as CompletionRequest & {
        response_format?: { type?: string };
      };
      expect(firstReq.response_format?.type).toBe('json_schema');
      expect(secondReq.response_format?.type).toBe('json_object');
    });

    it('caches the downgraded tier so the next stage skips json_schema entirely', async () => {
      const create = jest.fn(async (req: CompletionRequest) => {
        if (req.response_format?.json_schema) {
          throw makeUnsupportedError();
        }
        return tierAwareDispatch(req);
      });

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
              getClient: () => ({ chat: { completions: { create } } }),
              getModelFor: () => 'deepseek-v4-pro',
              getUseWebSearch: () => false,
              onProviderChange: () => () => undefined,
            },
          },
        ],
      }).compile();
      const localService = module.get(AiGameBlueprintService);

      // First call: 1 rejected json_schema + 1 successful json_object retry.
      await localService.generateStoryBible(baseInput);
      // Second call: should go STRAIGHT to json_object (cached); only +1 call.
      await localService.generateStoryBible(baseInput);

      expect(create).toHaveBeenCalledTimes(3);
      const types = create.mock.calls.map(
        (c) =>
          (c[0] as CompletionRequest & { response_format?: { type?: string } })
            .response_format?.type ?? 'none',
      );
      expect(types[0]).toBe('json_schema');
      expect(types[1]).toBe('json_object');
      // Cached: skip json_schema.
      expect(types[2]).toBe('json_object');
    });

    it('embeds the JSON schema into the prompt when downgraded so the model knows the shape', async () => {
      let firstCall = true;
      const create = jest.fn(async (req: CompletionRequest) => {
        if (firstCall && req.response_format?.json_schema) {
          firstCall = false;
          throw makeUnsupportedError();
        }
        return tierAwareDispatch(req);
      });

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
              getClient: () => ({ chat: { completions: { create } } }),
              getModelFor: () => 'deepseek-v4-pro',
              getUseWebSearch: () => false,
              onProviderChange: () => () => undefined,
            },
          },
        ],
      }).compile();
      const localService = module.get(AiGameBlueprintService);

      await localService.generateStoryBible(baseInput);
      const downgradedReq = create.mock.calls[1][0] as {
        messages: { role: string; content: string }[];
      };
      const userMessage = downgradedReq.messages.find((m) => m.role === 'user')!;
      expect(userMessage.content).toContain('RESPONSE FORMAT');
      expect(userMessage.content).toContain('storyBible');
      expect(userMessage.content).toContain('"properties"');
    });
  });
});

/**
 * Mock dispatcher that handles BOTH `json_schema` (name on the wire) and
 * the downgraded `json_object` / text tiers (name lives in the user prompt
 * after `appendJsonHint` injected the `call name: <name>` directive). The
 * tier-fallback specs swap the standard `makeMockClient` for this so they
 * can exercise the downgrade path end-to-end.
 */
async function tierAwareDispatch(
  req: CompletionRequest & { messages?: { role: string; content?: string }[] },
) {
  let name = req.response_format?.json_schema?.name;
  if (!name && req.messages) {
    for (let i = req.messages.length - 1; i >= 0; i--) {
      const content = req.messages[i].content;
      if (typeof content !== 'string') continue;
      const m = content.match(/call name: ([a-zA-Z]+)/);
      if (m) {
        name = m[1];
        break;
      }
    }
  }
  // Re-route through the standard mock by injecting the inferred name into
  // a synthetic response_format. Avoids duplicating the fixture map.
  const synth: CompletionRequest = {
    ...req,
    response_format: {
      json_schema: { name },
    },
  };
  const client = makeMockClient();
  return client.create(synth);
}

// ── useWebSearch=true: one-time `:online` research pack ──────────────────────
//
// The new pipeline runs a single `:online` web-search call up front, captures
// its plain-text output as the "research pack", and injects it into the
// downstream stage prompts. All structured-output stages must use the offline
// base model (no `:online` suffix) — that's the whole point of the refactor.

const RESEARCH_PACK_TEXT =
  'Wrocław · krasnale wrocławskie\n- Krasnal Papa, Rynek 1 (50.0680, 17.0306)\n- Krasnal Sysyfek, plac Solny\n- Legenda: pierwszy krasnal "Papa" odsłonięty 2005.';

describe('AiGameBlueprintService — useWebSearch=true', () => {
  let service: AiGameBlueprintService;
  let mockCreate: jest.Mock;

  const baseInput: BlueprintInput = {
    city: 'Wrocław',
    theme: 'śladami krasnali wrocławskich',
    flowType: GameFlowType.LINEAR,
    taskCount: 3,
    durationMinutes: 45,
    difficulty: 'MEDIUM',
    language: 'pl',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never;
    // The mock dispatcher distinguishes the research call (no
    // `response_format`) from the structured stages and returns plain text
    // for the former.
    const create = jest.fn(
      async (req: CompletionRequest & { response_format?: unknown }) => {
        if (!req.response_format) {
          return {
            choices: [
              {
                message: { content: RESEARCH_PACK_TEXT },
                finish_reason: 'stop',
              },
            ],
          };
        }
        const inner = makeMockClient();
        return inner.create(req);
      },
    );
    mockCreate = create;
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
            getClient: () => ({ chat: { completions: { create } } }),
            getModelFor: () => 'anthropic/claude-sonnet-4-5',
            getUseWebSearch: () => true,
          },
        },
      ],
    }).compile();
    service = module.get(AiGameBlueprintService);
  });

  it('runs ONE `:online` research call before any structured stage', async () => {
    await service.generateGameBlueprint(baseInput);
    // 1 research + 1 bible + 1 outline + 3 tasks + 1 transitions + 1 endings = 8
    expect(mockCreate).toHaveBeenCalledTimes(8);
    const first = mockCreate.mock.calls[0][0];
    expect(first.response_format).toBeUndefined();
    expect(first.model).toBe('anthropic/claude-sonnet-4-5:online');
  });

  it('uses the OFFLINE base model for every structured stage', async () => {
    await service.generateGameBlueprint(baseInput);
    const structuredCalls = mockCreate.mock.calls
      .map((c) => c[0] as { model: string; response_format?: unknown })
      .filter((c) => c.response_format !== undefined);
    expect(structuredCalls).toHaveLength(7);
    for (const call of structuredCalls) {
      expect(call.model).toBe('anthropic/claude-sonnet-4-5');
      expect(call.model.endsWith(':online')).toBe(false);
    }
  });

  it('injects the research pack into storyBible / outline / task prompts', async () => {
    await service.generateGameBlueprint(baseInput);
    const stages = ['storyBible', 'gameOutline', 'singleTask'] as const;
    for (const stage of stages) {
      const call = mockCreate.mock.calls.find(
        (c) =>
          (c[0] as CompletionRequest).response_format?.json_schema?.name === stage,
      );
      expect(call).toBeDefined();
      const userMessage = (
        call![0] as { messages: { role: string; content: string }[] }
      ).messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('RESEARCH PACK');
      expect(userMessage?.content).toContain('Krasnal Papa');
    }
  });

  it('falls back gracefully when the research call returns empty content', async () => {
    // Re-wire the mock so the research call returns no content. The pipeline
    // must keep going (no 502) and downstream prompts must NOT contain a
    // RESEARCH PACK block.
    const create = jest.fn(
      async (req: CompletionRequest & { response_format?: unknown }) => {
        if (!req.response_format) {
          return {
            choices: [{ message: { content: '' }, finish_reason: 'unknown' }],
          };
        }
        return makeMockClient().create(req);
      },
    );
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
            getClient: () => ({ chat: { completions: { create } } }),
            getModelFor: () => 'anthropic/claude-sonnet-4-5',
            getUseWebSearch: () => true,
          },
        },
      ],
    }).compile();
    const localService = module.get(AiGameBlueprintService);

    const blueprint = await localService.generateGameBlueprint(baseInput);
    expect(blueprint.tasks).toHaveLength(3);
    const bibleCall = create.mock.calls.find(
      (c) =>
        (c[0] as CompletionRequest).response_format?.json_schema?.name ===
        'storyBible',
    );
    const userMessage = (
      bibleCall![0] as { messages: { role: string; content: string }[] }
    ).messages.find((m) => m.role === 'user');
    expect(userMessage?.content).not.toContain('RESEARCH PACK');
  });
});
