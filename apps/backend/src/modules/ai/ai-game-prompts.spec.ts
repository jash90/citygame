import {
  buildEndingsPrompt,
  buildOutlinePrompt,
  buildSingleTaskPrompt,
  buildStoryBiblePrompt,
  buildTaskForPoiPrompt,
  effectiveEndingCount,
  type BlueprintPromptInput,
} from './ai-game-prompts';
import { GameFlowType } from '@citygame/shared';
import type { BlueprintOutline, StoryBible, TaskType } from '@citygame/shared';

const baseInput: BlueprintPromptInput = {
  city: 'Kraków',
  theme: 'Średniowieczne legendy',
  flowType: GameFlowType.BRANCHING,
  taskCount: 6,
  durationMinutes: 90,
  difficulty: 'MEDIUM',
  language: 'pl',
  endingCount: 4,
};

const baseBible: StoryBible = {
  protagonistRole: 'młody kronikarz',
  questGiver: {
    name: 'Mistrz Wojciech',
    role: 'starszy bibliotekarz katedralny',
    motivation: 'odnaleźć zaginiony rękopis przed świtem',
    voiceTrait: 'mówi w archaicznych zwrotach, używa łacińskich wtrętów',
  },
  antagonist: null,
  macguffin: {
    name: 'Rękopis Lamentacji',
    significance:
      'starożytny manuskrypt, którego treść może zmienić bieg historii miasta',
  },
  centralMystery:
    'Co zniknęło wraz z ostatnim opiekunem rękopisu i dlaczego księgi w bibliotece nadal śpiewają?',
  toneAnchors: ['melancholijny', 'tajemniczy', 'staroświecki'],
  thematicMotifs: ['stare księgi', 'gasnące świece', 'zegary o północy'],
  recurringCharacters: [
    {
      id: 'stary_kronikarz',
      name: 'Stary Kronikarz',
      role: 'duch dawnego pisarza',
      voiceTrait: 'szepcze fragmenty zapomnianych tekstów',
      appearsAtPoiHints: ['na początku', 'około połowy gry'],
    },
  ],
  endingsSkeleton: [
    {
      label: 'good_ending',
      summary: 'Bohater odnajduje rękopis i ujawnia jego treść.',
      requiredCluesPlanted: [
        'pieczęć opata zostaje rozpoznana',
        'data 1492 pojawia się w napisach',
      ],
    },
    {
      label: 'tragic_ending',
      summary: 'Bohater odkrywa rękopis za późno.',
      requiredCluesPlanted: ['zegar wybija północ', 'gasnąca świeca'],
    },
    {
      label: 'secret_ending',
      summary: 'Bohater odkrywa, że jest potomkiem ostatniego kronikarza.',
      requiredCluesPlanted: ['imię chrzestne dziadka'],
    },
    {
      label: 'default_timeout',
      summary: 'Czas się kończy zanim bohater zdąży otworzyć rękopis.',
      requiredCluesPlanted: [],
    },
  ],
};

describe('effectiveEndingCount', () => {
  it('forces LINEAR to 1 regardless of endingCount input', () => {
    expect(
      effectiveEndingCount({
        ...baseInput,
        flowType: GameFlowType.LINEAR,
        endingCount: 5,
      }),
    ).toBe(1);
  });
  it('clamps endingCount into 2-6', () => {
    expect(
      effectiveEndingCount({ ...baseInput, endingCount: 1 }),
    ).toBeGreaterThanOrEqual(2);
    expect(
      effectiveEndingCount({ ...baseInput, endingCount: 99 }),
    ).toBeLessThanOrEqual(6);
  });
  it('falls back to 3 for non-LINEAR with no override', () => {
    expect(
      effectiveEndingCount({ ...baseInput, endingCount: undefined }),
    ).toBe(3);
  });
});

describe('buildStoryBiblePrompt', () => {
  it('mentions the city, theme, and exact ending count', () => {
    const prompt = buildStoryBiblePrompt(baseInput);
    expect(prompt).toContain('Kraków');
    expect(prompt).toContain('Średniowieczne legendy');
    expect(prompt).toMatch(/EXACTLY 4 entries/);
    expect(prompt).toContain('submitStoryBible');
  });

  it('uses 1 entry for LINEAR flows', () => {
    const prompt = buildStoryBiblePrompt({
      ...baseInput,
      flowType: GameFlowType.LINEAR,
      endingCount: undefined,
    });
    expect(prompt).toMatch(/exactly 1 endingsSkeleton entry/);
  });

  it('marks BRANCHING-specific guidance when applicable', () => {
    const prompt = buildStoryBiblePrompt(baseInput);
    expect(prompt).toMatch(/BRANCHING flow/);
    expect(prompt).toMatch(/3 entries are branch leaves/);
  });
});

describe('buildOutlinePrompt', () => {
  it('embeds the full bible as authoritative context', () => {
    const prompt = buildOutlinePrompt(baseInput, undefined, baseBible);
    expect(prompt).toContain('STORY BIBLE (authoritative');
    expect(prompt).toContain('"protagonistRole": "młody kronikarz"');
    expect(prompt).toContain('Mistrz Wojciech');
  });

  it('lists recurring-character ids when bible has any', () => {
    const prompt = buildOutlinePrompt(baseInput, undefined, baseBible);
    expect(prompt).toContain('stary_kronikarz');
    expect(prompt).toMatch(/Available recurring-character ids/);
  });

  it('tells the model to leave recurringCharacterIds empty when bible has no recurring cast', () => {
    const emptyBible: StoryBible = { ...baseBible, recurringCharacters: [] };
    const prompt = buildOutlinePrompt(baseInput, undefined, emptyBible);
    expect(prompt).toMatch(/leave every POI's recurringCharacterIds empty/);
  });
});

describe('buildTaskForPoiPrompt', () => {
  const samplePoi: BlueprintOutline['pois'][number] = {
    index: 3,
    name: 'Stary Rynek',
    latitude: 50.0614,
    longitude: 19.9366,
    role: 'PUZZLE',
    summary: 'Branch 1',
    narrativeBeat: 'midpoint',
    recurringCharacterIds: ['stary_kronikarz'],
    plantedClues: ['pieczęć opata zostaje rozpoznana'],
  };

  it('injects the bible, beat gloss, character context, and clue list', () => {
    const prompt = buildTaskForPoiPrompt(
      baseInput,
      JSON.stringify({ pois: [samplePoi] }, null, 2),
      3,
      undefined,
      baseBible,
      samplePoi,
    );
    expect(prompt).toContain('STORY BIBLE');
    expect(prompt).toContain('TONE ANCHORS');
    expect(prompt).toMatch(/midpoint.*turn/);
    expect(prompt).toContain('Stary Kronikarz');
    expect(prompt).toContain('pieczęć opata zostaje rozpoznana');
  });

  it('falls back to a "no recurring characters" hint when none are present', () => {
    const lonelyPoi = { ...samplePoi, recurringCharacterIds: [] };
    const prompt = buildTaskForPoiPrompt(
      baseInput,
      '{}',
      3,
      undefined,
      baseBible,
      lonelyPoi,
    );
    expect(prompt).toMatch(/RECURRING CHARACTERS PRESENT AT THIS POI: none/);
  });
});

describe('buildEndingsPrompt', () => {
  it('reframes as a fill-the-skeleton task and embeds the skeleton', () => {
    const prompt = buildEndingsPrompt(baseInput, '{}', '{}', baseBible);
    expect(prompt).toMatch(/FILL the endings skeleton/);
    expect(prompt).toContain('"label": "good_ending"');
    expect(prompt).toMatch(/Emit EXACTLY 4 endings/);
  });
});

describe('buildSingleTaskPrompt', () => {
  it('omits the bible block when no bible is supplied', () => {
    const prompt = buildSingleTaskPrompt(baseInput, '{}', 1);
    expect(prompt).not.toContain('STORY BIBLE');
  });

  it('includes the bible block when one is supplied', () => {
    const prompt = buildSingleTaskPrompt(baseInput, '{}', 1, baseBible);
    expect(prompt).toContain('STORY BIBLE (authoritative');
    expect(prompt).toContain('TONE ANCHORS');
  });
});

// Compile-time guard: keep TaskType import wired so tsc doesn't trim it.
// (The prompts module re-exports it transitively; explicit reference keeps
// the editor's "remove unused" actions from breaking the test imports.)
const _typeGuard: TaskType | undefined = undefined;
void _typeGuard;
