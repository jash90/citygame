import { TaskType } from '@citygame/shared';
import type {
  BlueprintOutline,
  GameFlowType,
  StoryBible,
} from '@citygame/shared';

export interface BlueprintPromptInput {
  city: string;
  theme: string;
  flowType: GameFlowType;
  taskCount: number;
  durationMinutes: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  language: string;
  audience?: string;
  tone?: string;
  notes?: string;
  allowedTaskTypes?: TaskType[];
  mixedComponentTypes?: TaskType[];
  endingCount?: number;
}

/**
 * Effective ending count to instruct the AI with. LINEAR is always 1
 * regardless of input; non-LINEAR honours the admin override (2–6) and
 * falls back to a sensible default per flow type.
 */
export function effectiveEndingCount(input: BlueprintPromptInput): number {
  if (input.flowType === 'LINEAR') return 1;
  if (typeof input.endingCount === 'number') {
    return Math.min(6, Math.max(2, Math.round(input.endingCount)));
  }
  return input.flowType === 'BRANCHING' ? 3 : 3;
}

/**
 * Maps recurring-character ids picked on a POI back to their full bible
 * entries, dropping unknown ids. Used inside `buildTaskForPoiPrompt` so the
 * model sees `name + role + voiceTrait` rather than the bare id.
 */
function resolveRecurringCharacters(
  ids: ReadonlyArray<string> | undefined,
  bible: StoryBible,
): StoryBible['recurringCharacters'] {
  if (!ids || ids.length === 0) return [];
  const byId = new Map(bible.recurringCharacters.map((c) => [c.id, c]));
  return ids
    .map((id) => byId.get(id))
    .filter((c): c is StoryBible['recurringCharacters'][number] => c != null);
}

/**
 * Returns a prompt fragment listing allowed task types when the admin has
 * narrowed the set, otherwise an empty string. Centralised so every call
 * (outline + per-task) phrases the constraint identically.
 */
function allowedTaskTypesClause(input: BlueprintPromptInput): string {
  if (!input.allowedTaskTypes || input.allowedTaskTypes.length === 0) return '';
  const list = [...new Set(input.allowedTaskTypes)].join(', ');
  return `\nALLOWED TASK TYPES (HARD CONSTRAINT): every task's 'type' field MUST be one of: ${list}. Do not use any other type even if it would fit narratively.`;
}

/**
 * Returns a prompt fragment naming the sub-types the model may combine when
 * generating a task whose `type` is `MIXED`. Empty when the admin left the
 * setting open, or when MIXED is not in the allowed set (no MIXED to control).
 */
function mixedComponentsClause(input: BlueprintPromptInput): string {
  const mixedAllowed =
    !input.allowedTaskTypes ||
    input.allowedTaskTypes.length === 0 ||
    input.allowedTaskTypes.includes(TaskType.MIXED);
  if (!mixedAllowed) return '';
  if (!input.mixedComponentTypes || input.mixedComponentTypes.length < 2) {
    return '';
  }
  const list = [...new Set(input.mixedComponentTypes)]
    .filter((t) => t !== TaskType.MIXED)
    .join(', ');
  return `\nMIXED TASKS — when generating a task whose 'type' is MIXED, combine TWO OR MORE of these component types in a single multi-step puzzle: ${list}. The player must satisfy each chosen component to clear the task; reflect this in the description, hints, and verifyConfig.`;
}

const FLOW_DESCRIPTIONS: Record<GameFlowType, string> = {
  LINEAR:
    'a linear sequence of tasks; transitions form a single chain start→t1→t2→...→tN.',
  BRANCHING:
    'a directed graph with branches; player choices steer the route and reach different endings.',
  OPEN_WORLD:
    'every task is reachable from start (parallel transitions from `null`); the ending fires by score / item conditions.',
  MIXED:
    'hub-and-spoke; one or two HUB tasks gate spokes that must return to a hub before unlocking the next branch.',
};

const URBAN_DESIGN_PRINCIPLES = `URBAN-GAME DESIGN PRINCIPLES (apply rigorously):
- Clue language: every task description must hint at the NEXT location through riddle, sensory cue, history, or a nearby landmark — NEVER name the destination (e.g. "between two stone lions facing the river" rather than "Adam Mickiewicz Square").
- Cipher / code chain: in non-LINEAR games, plan AT LEAST ONE pair of POIs with roles CIPHER_SOURCE (earlier) and CIPHER_LOCK (later) in the outline. The backend pre-assigns the slug + value for each planned pair and injects them into the per-task generation; do NOT invent additional cipher chains on other POIs (any task without an explicit cipher instruction must leave revealsItem and unlockRequirements as null).
- Variety: distribute task types so no two adjacent tasks share the same TaskType where possible. Pick from QR_SCAN, GPS_REACH, PHOTO_AI, AUDIO_AI, TEXT_EXACT, TEXT_AI, CIPHER, MIXED.
- Difficulty curve: easy warm-up at task 1, hardest puzzle around 75% of the path, gentler final task to land the ending well.
- Hub-and-spoke (MIXED only): designate a HUB POI; spokes return to the hub before the next branch unlocks.
- Forks (BRANCHING only — IMPORTANT):
  - The number of branches equals (endingCount − 1) — every non-DEFAULT ending must have its own dedicated branch. So for 3 endings emit a 2-way fork, for 5 endings emit a 4-way fork, etc. (Use the chosen endingCount the admin requested.)
  - Keep the shared trunk SHORT — at most 1 introductory POI (or zero if endingCount ≥ 4 and tasks are tight). The player should diverge into their unique path almost immediately so EACH ending has an almost-non-repeating path.
  - At the fork POI, emit N outgoing transitions (one per branch) sharing the same fromTaskIndex but different toTaskIndex, each with a distinct non-empty 'label' that names the player's choice (e.g. "tunelem", "wieżą", "rzeką", "katakumbami").
  - Branches stay separate to the end — they do NOT re-converge. No task is reachable from more than one branch.
  - Each branch terminates in its OWN dedicated ending. Picking one branch's option closes every other branch's ending — the player can no longer reach them within this run.
  - Endings on each branch use ALL_OF whose taskIndices list ONLY tasks on that branch (plus the trunk task if any). NEVER list tasks from sibling branches.
  - One DEFAULT ending captures the timeout/abandon case; mark it isDefault=true with condition { type: "DEFAULT" } at the highest orderIndex so it runs last as a fallback. Total endings = N branches + 1 DEFAULT.
  - Cipher chains (revealsItem → unlockRequirements) MUST be contained on ONE branch (or fully on the trunk). A cipher source on one branch and a lock on another is unreachable.
  - Distribute the taskCount as evenly as possible across the N branches: each branch ≈ floor((taskCount − trunkSize) / N) tasks.
- Endings (non-LINEAR, non-BRANCHING — i.e. OPEN_WORLD/MIXED): produce 2–4 endings — one "good" (intended path), one "bad" (failure / time-out / wrong cipher) using TIMEOUT or SCORE_GTE-failure logic, optionally one "secret" hidden side-objective triggered by ITEM_COLLECTED. For LINEAR games produce exactly ONE ending with isDefault=true and condition { type: "DEFAULT" }.
- Cultural fidelity: keep historical/geographic facts accurate to the city; if uncertain, prefer generic descriptors over invented ones.
- Coordinates: use real, plausible lat/lng for the named city.
- AI prompts: when type is PHOTO_AI / TEXT_AI / AUDIO_AI, include a clear 'aiPrompt' describing what a correct submission looks like, plus 'aiThreshold' between 0.5 and 0.85.
- Exact answers: when type is TEXT_EXACT, CIPHER, or QR_SCAN, include 'expectedAnswer' (plaintext, the backend hashes it). For QR_SCAN, 'expectedAnswer' is the literal text/URL encoded into the printed QR code (e.g. "STRZYZOW-RYNEK-1" or "https://city.game/checkpoint/1") — keep it short, unique, and easy for the operator to print on a sticker.
- maxPoints: roughly 50 (easy) → 100 (medium) → 200 (hard). Total game ≈ taskCount × averagePoints.`;

export interface CityGeocodeAnchor {
  centerLat: number;
  centerLon: number;
  bbox: { south: number; north: number; west: number; east: number };
}

/**
 * Stage 1 of the pipeline. Produces the narrative skeleton — protagonist,
 * quest giver, antagonist, macguffin, tone anchors, thematic motifs, the
 * recurring cast, and the endings skeleton — that every later stage reads as
 * authoritative context. Generation is cheap (~600 output tokens) and the
 * downstream cost reduction (fewer task/ending retries because the model
 * isn't reinventing characters and clues call-by-call) more than pays for it.
 */
export function buildStoryBiblePrompt(input: BlueprintPromptInput): string {
  const flowDesc = FLOW_DESCRIPTIONS[input.flowType];
  const audience = input.audience
    ? `Target audience: ${input.audience}.`
    : 'Target audience: general adult players.';
  const tone = input.tone
    ? `Tone: ${input.tone}.`
    : 'Tone: engaging, immersive.';
  const notes = input.notes ? `Additional notes: ${input.notes}` : '';
  const endingCount = effectiveEndingCount(input);

  const branchingNote =
    input.flowType === 'BRANCHING'
      ? `\nBRANCHING flow: produce ${endingCount} endingsSkeleton entries — exactly one of them is the DEFAULT/timeout fallback (its label SHOULD include "default" or "timeout"); the other ${endingCount - 1} entries are branch leaves the player can reach by choice.`
      : input.flowType === 'LINEAR'
        ? '\nLINEAR flow: emit exactly 1 endingsSkeleton entry — it IS the default ending.'
        : `\nOPEN_WORLD/MIXED flow: produce ${endingCount} endingsSkeleton entries (e.g. one good, one bad/timeout, optionally one secret). Exactly one will become the DEFAULT fallback in the final endings.`;

  return `You are a city-game designer crafting the NARRATIVE SKELETON for an urban exploration game in ${input.city}. This skeleton is the single source of truth — every later stage (outline → tasks → endings) will reference it and MUST NOT contradict it.

City: ${input.city}
Theme: ${input.theme}
Flow type: ${input.flowType} — ${flowDesc}
Number of tasks: ${input.taskCount}
Endings to plan: ${endingCount}
Difficulty: ${input.difficulty}
Language for player-facing text: ${input.language}
${audience}
${tone}
${notes}${branchingNote}

Use the 'submitStoryBible' tool. Produce:
- protagonistRole: a clear, evocative one-phrase role (e.g. "young apprentice scribe", "skeptical city detective"). NOT a name.
- questGiver: the in-fiction character who hires/sends the player on the journey. Provide name (locale-appropriate for ${input.language}), role, motivation (1 sentence), voiceTrait (1 sentence describing how they speak — vocabulary, rhythm, mannerism — e.g. "uses old proverbs and speaks in fragments").
- antagonist: only when the theme implies conflict or for non-OPEN_WORLD games. Provide name, motivation, revealMode = "known_from_start" | "midpoint" | "climax_twist". Set null when no clear antagonist fits.
- macguffin: optional but recommended for non-LINEAR. The thing the player chases (a lost diary, a hidden key, a banished name). Set null only if the theme is structured around a journey rather than an object.
- centralMystery: 1-2 sentences. The driving question of the game.
- toneAnchors: 3-5 single-word adjectives that describe the voice ALL prose must respect. Concrete and specific (e.g. "melancholic", "wry", "hushed"). Avoid generic words like "exciting".
- thematicMotifs: 2-5 concrete nouns or short phrases that recur (e.g. "broken clocks", "silver thread", "the river's voice"). These will appear in multiple tasks.
- recurringCharacters: 0-5 characters (in addition to questGiver) who reappear at multiple POIs. Each gets:
    - id: lowercase a-z, 0-9, _ only (e.g. "stary_kronikarz")
    - name (locale-appropriate)
    - role
    - voiceTrait
    - appearsAtPoiHints: natural-language hints describing where they appear (e.g. ["in a quiet courtyard near the cathedral", "around the halfway point", "the final POI"]).
  Recurring cast is OPTIONAL — leave the array empty for short or solo-protagonist games.
- endingsSkeleton: EXACTLY ${endingCount} entries. Each with:
    - label: lowercase slug (e.g. "good_ending", "betrayed_ending", "default_timeout")
    - summary: 1-2 sentence outcome description
    - requiredCluesPlanted: 1-4 concrete clue strings that must appear in earlier tasks for this ending to make sense (e.g. "the seal of the lost guild is recognised", "the protagonist learns the questGiver's hidden name").

Hard constraints:
- toneAnchors MUST be 3-5 entries, thematicMotifs MUST be 2-5, recurringCharacters MUST be at most 5, endingsSkeleton.length MUST equal ${endingCount}.
- The questGiver SHOULD naturally appear at the START POI (mentioned in their appearsAtPoiHints isn't required since they aren't in recurringCharacters, but think about where the prologue places them).
- Recurring characters work best when they reappear at 2+ spread-out POIs across the arc.
- requiredCluesPlanted strings must be specific enough that a later stage can plant them in concrete task body / storyContext.`;
}

export function buildOutlinePrompt(
  input: BlueprintPromptInput,
  geo: CityGeocodeAnchor | undefined,
  bible: StoryBible,
): string {
  const flowDesc = FLOW_DESCRIPTIONS[input.flowType];
  const audience = input.audience
    ? `Target audience: ${input.audience}.`
    : 'Target audience: general adult players.';
  const tone = input.tone ? `Tone: ${input.tone}.` : 'Tone: engaging, immersive.';
  const notes = input.notes ? `Additional notes: ${input.notes}` : '';

  const geoBlock = geo
    ? `

GEOCODED CITY ANCHOR (HARD CONSTRAINT — these are real coordinates from OpenStreetMap):
- Center: ${geo.centerLat.toFixed(5)}, ${geo.centerLon.toFixed(5)}
- Bounding box (lat/lon): south=${geo.bbox.south.toFixed(5)}, north=${geo.bbox.north.toFixed(5)}, west=${geo.bbox.west.toFixed(5)}, east=${geo.bbox.east.toFixed(5)}
RULES:
- Every POI's latitude MUST satisfy ${geo.bbox.south.toFixed(5)} ≤ lat ≤ ${geo.bbox.north.toFixed(5)} (with at most 0.02° overshoot for outskirts).
- Every POI's longitude MUST satisfy ${geo.bbox.west.toFixed(5)} ≤ lon ≤ ${geo.bbox.east.toFixed(5)} (same overshoot rule).
- SPREAD the POIs across the bbox — do NOT cluster them within a 100 m radius. Aim for at least ~200 m between adjacent POIs (≈ 0.002° latitude, ≈ 0.003° longitude at this latitude).
- Anchor each POI to a real, named place (church, market square, monument, park, bridge, museum) that actually exists in the city. If unsure, use plausible coordinates inside the bbox rather than inventing a location outside it.`
    : '';

  const recurringIds = bible.recurringCharacters.map((c) => c.id);
  const recurringIdsLine =
    recurringIds.length > 0
      ? `Available recurring-character ids (use these EXACT ids in 'recurringCharacterIds'): ${recurringIds.join(', ')}.`
      : 'No recurring cast — leave every POI\'s recurringCharacterIds empty.';

  return `You are a city-game designer. Sketch the OUTLINE of a new game.

STORY BIBLE (authoritative — every later stage will read it; do NOT contradict any of these decisions):
${JSON.stringify(bible, null, 2)}

City: ${input.city}
Theme: ${input.theme}
Flow type: ${input.flowType} — ${flowDesc}
Number of tasks: ${input.taskCount}
Estimated duration: ${input.durationMinutes} minutes
Difficulty: ${input.difficulty}
Language for player-facing text: ${input.language}
${audience}
${tone}
${notes}
${geoBlock}

${URBAN_DESIGN_PRINCIPLES}${allowedTaskTypesClause(input)}${mixedComponentsClause(input)}

Use the 'submitGameOutline' tool. Each POI carries 1-based 'index' that matches the future task list order. Use roles START, HUB, PUZZLE, CIPHER_SOURCE, CIPHER_LOCK, FINAL to mark special positions. Provide EXACTLY ${effectiveEndingCount(input)} entries in 'endingHints' (one short flavour per planned ending).

STORY-BIBLE-DRIVEN POI ENRICHMENT — apply to EVERY POI:
- narrativeBeat: assign one of "hook" | "rising" | "midpoint" | "complication" | "climax" | "resolution" so the per-POI task generator knows the dramatic position. Curve: hook at task 1, rising for the next 30-40%, midpoint near the middle, complication after, climax around 75-90%, resolution at the leaf POI(s).
- recurringCharacterIds: array of ids from the bible's recurringCharacters that appear at THIS POI. ${recurringIdsLine} Pick ids that match each character's appearsAtPoiHints. Spread cameos so a recurring character shows up at 2+ POIs across the arc.
- plantedClues: list 1-3 concrete clue strings this POI's task MUST surface. Draw from the bible's endingsSkeleton[].requiredCluesPlanted — every required clue listed in the skeleton must be planted at SOME POI on the path that reaches that ending. Phrase each clue concretely so the per-task generator can fold it into the narrative or puzzle (e.g. "the seal of the lost guild is shown on a tomb engraving here").${
    input.flowType === 'BRANCHING'
      ? (() => {
          const branches = Math.max(1, effectiveEndingCount(input) - 1);
          const trunkSize = branches >= 4 ? 0 : 1;
          const perBranch = Math.max(
            1,
            Math.floor((input.taskCount - trunkSize) / branches),
          );
          const trunkLine =
            trunkSize === 0
              ? `no shared introduction — fork from the very start (emit one null→branchStart transition per branch, ${branches} total).`
              : `at most ${trunkSize} introductory POI before the fork.`;
          return `

BRANCHING-specific outline guidance:
- Player must reach ONE of ${branches} mutually exclusive endings (plus a DEFAULT timeout fallback) — so plan ${branches} disjoint branches, each ≈ ${perBranch} POIs long.
- Trunk: ${trunkLine}
- Group POIs into contiguous blocks, one per branch. Use each POI's 'summary' to state which branch it belongs to (e.g. "Branch 1", "Branch 2", … "Branch ${branches}") or that it is the trunk.
- Branches MUST NOT share any POI and MUST NOT reconverge — each ends on its own FINAL POI that triggers a distinct ending.
- If you include cipher chains, BOTH the CIPHER_SOURCE and CIPHER_LOCK MUST be on the same branch (or both on the trunk). A source/lock pair across branches would be unreachable.
- Provide ${effectiveEndingCount(input)} entries in 'endingHints': one per branch leaf + one DEFAULT/timeout fallback.
- Plant each non-DEFAULT ending's requiredCluesPlanted on POIs that lie on THAT ending's branch (or trunk). The DEFAULT ending plants no clues.`;
        })()
      : ''
  }`;
}

export function buildTasksPrompt(
  input: BlueprintPromptInput,
  outlineJson: string,
): string {
  return `You are a city-game designer. Hydrate the outline below into a full task list.

Input:
${JSON.stringify(input, null, 2)}

Outline:
${outlineJson}

${URBAN_DESIGN_PRINCIPLES}

Use the 'submitTasks' tool. Each task's 'index' MUST match the corresponding POI 'index' from the outline. For non-LINEAR games include at least one cipher chain (a 'revealsItem' on a CIPHER_SOURCE task and a matching 'unlockRequirements' on a CIPHER_LOCK task). Hints (1–3 per task) progress from gentle → revealing.`;
}

export interface CipherAssignment {
  /** What the player will see / type — used as both `revealsItem.value` on the
   *  source task and `expectedAnswer` on the lock task. */
  value: string;
  /** Stable identifier shared by source.revealsItem.slug and
   *  lock.unlockRequirements.requiresItem. */
  slug: string;
  kind: 'CODE' | 'WORD' | 'SYMBOL' | 'NUMBER';
  label: string;
  role: 'CIPHER_SOURCE' | 'CIPHER_LOCK';
}

const NARRATIVE_BEAT_GLOSS: Record<string, string> = {
  hook: 'opening — establish protagonist + place; warmest possible welcome; minimal mechanical difficulty.',
  rising: 'tension building — introduce a complication or curiosity; mid-light difficulty; pace picks up.',
  midpoint: 'turn — the story shifts gears (revelation, ally or rival appears, hidden cost surfaces); medium difficulty.',
  complication: 'pressure — stakes rise; cipher locks or commitments lock in; sharper difficulty.',
  climax: 'crescendo — the hardest task; everything in the bible should converge here; the protagonist confronts the central mystery directly.',
  resolution: 'cool-down at the leaf POI — wrap up the chosen branch; light mechanical difficulty so the ending lands cleanly.',
};

export function buildTaskForPoiPrompt(
  input: BlueprintPromptInput,
  outlineJson: string,
  poiIndex: number,
  cipher: CipherAssignment | undefined,
  bible: StoryBible,
  poi: BlueprintOutline['pois'][number],
): string {
  // The cipher source/lock pair must use a type that produces an
  // `expectedAnswer` (CIPHER or TEXT_EXACT). Pick one that's also in the
  // admin's allowed set; fall back to CIPHER if neither was excluded.
  const allowedSet = new Set(input.allowedTaskTypes ?? []);
  const cipherLockType =
    input.allowedTaskTypes && input.allowedTaskTypes.length > 0
      ? allowedSet.has(TaskType.CIPHER)
        ? TaskType.CIPHER
        : allowedSet.has(TaskType.TEXT_EXACT)
          ? TaskType.TEXT_EXACT
          : input.allowedTaskTypes[0]
      : TaskType.CIPHER;

  let cipherInstruction = '';
  if (cipher?.role === 'CIPHER_SOURCE') {
    cipherInstruction = `\n\nCIPHER SOURCE — REQUIRED FIELDS (use these EXACT values):
- revealsItem.slug = "${cipher.slug}"
- revealsItem.kind = "${cipher.kind}"
- revealsItem.value = "${cipher.value}"
- revealsItem.label = "${cipher.label}"
- Do NOT set 'unlockRequirements' on this task.
The player must be able to derive the value "${cipher.value}" from solving this task; weave it into the puzzle so it becomes visible/known after success.`;
  } else if (cipher?.role === 'CIPHER_LOCK') {
    cipherInstruction = `\n\nCIPHER LOCK — REQUIRED FIELDS (use these EXACT values):
- unlockRequirements.requiresItem = "${cipher.slug}"
- unlockRequirements.expectedAnswer = "${cipher.value}"
- expectedAnswer = "${cipher.value}"
- caseSensitive = false
- type = "${cipherLockType}"
- Do NOT set 'revealsItem' on this task.
The player will only solve this if they previously obtained the item slug "${cipher.slug}" with value "${cipher.value}".`;
  } else {
    // Non-cipher POI: forbid the model from inventing its own cipher slugs,
    // which would orphan the requiresItem (no source) and break the final
    // gameBlueprintSchema check.
    cipherInstruction = `\n\nCIPHER FIELDS — STRICTLY FORBIDDEN ON THIS TASK:
- Do NOT set 'revealsItem' on this task. Set it to null.
- Do NOT set 'unlockRequirements' on this task. Set it to null.
- Cipher chains are handled by dedicated CIPHER_SOURCE / CIPHER_LOCK POIs elsewhere in this game; this POI is NOT one of them.`;
  }

  const presentCharacters = resolveRecurringCharacters(
    poi.recurringCharacterIds,
    bible,
  );
  const charactersBlock =
    presentCharacters.length > 0
      ? `\nRECURRING CHARACTERS PRESENT AT THIS POI (each MUST be referenced by name in storyContext.characterName or taskNarrative; respect their voiceTrait):\n${presentCharacters
          .map(
            (c) =>
              `- ${c.name} (${c.role}) — voice: ${c.voiceTrait} — id: ${c.id}`,
          )
          .join('\n')}`
      : '\nRECURRING CHARACTERS PRESENT AT THIS POI: none — invent a one-off NPC for storyContext.characterName if useful, but do NOT promote them into the recurring cast.';

  const plantedClues = poi.plantedClues ?? [];
  const cluesBlock =
    plantedClues.length > 0
      ? `\nCLUES TO PLANT IN THIS TASK (the endings rely on these — surface each one in storyContext.clueRevealed or weave it into the puzzle / hints):\n${plantedClues
          .map((c) => `- ${c}`)
          .join('\n')}`
      : '\nCLUES TO PLANT IN THIS TASK: none — focus on the local POI fact and the narrativeBeat.';

  const beatLine = poi.narrativeBeat
    ? `\nTHIS POI'S NARRATIVE BEAT: "${poi.narrativeBeat}" — ${NARRATIVE_BEAT_GLOSS[poi.narrativeBeat] ?? 'unspecified beat — match the dramatic position of this POI in the arc.'}`
    : '';

  return `You are a city-game designer. Hydrate ONE POI from the outline into a complete task.

STORY BIBLE (authoritative — every word you write must respect these decisions):
${JSON.stringify(bible, null, 2)}

TONE ANCHORS (every adjective/verb you write must respect these): ${bible.toneAnchors.join(', ')}.
THEMATIC MOTIFS (use at least one in the task body if it fits naturally): ${bible.thematicMotifs.join(', ')}.
${beatLine}${charactersBlock}${cluesBlock}

Input:
${JSON.stringify(input, null, 2)}

Outline (full game context — for variety/cipher chain consistency):
${outlineJson}

${URBAN_DESIGN_PRINCIPLES}${allowedTaskTypesClause(input)}${mixedComponentsClause(input)}

Generate the task for the POI whose 'index' equals ${poiIndex}. Set the task's 'index' to ${poiIndex} and reuse that POI's latitude/longitude (small adjustments are OK if the POI is intentionally approximate). Provide 1–3 hints. For PHOTO_AI / TEXT_AI / AUDIO_AI tasks include 'aiPrompt' and 'aiThreshold' (0.5–0.85). For TEXT_EXACT, CIPHER, or QR_SCAN tasks include 'expectedAnswer' (for QR_SCAN it is the literal text encoded in the QR sticker, e.g. "STRZYZOW-RYNEK-1").

If the chosen 'type' is MIXED, you MUST also emit 'mixedSteps' as an array of 2–5 sub-step objects. Each sub-step has its own 'type' (NEVER 'MIXED' itself) drawn from the admin's allowed component list, plus the same per-type config fields a standalone task would carry:
  - QR_SCAN step → 'expectedAnswer' (sticker text)
  - TEXT_EXACT or CIPHER step → 'expectedAnswer' (plaintext, optionally 'cipherHint' for CIPHER)
  - PHOTO_AI / TEXT_AI / AUDIO_AI step → 'aiPrompt' + 'aiThreshold' (0.5–0.85)
  - GPS_REACH step → optional 'radiusMeters' (defaults to the parent task's location)
The player completes each sub-step in order; design steps so the narrative flows (e.g. scan QR at the door → answer the riddle inside → photograph the proof). Top-level 'expectedAnswer' / 'aiPrompt' on a MIXED task are ignored — put per-step content in 'mixedSteps' instead.

ALWAYS provide 'storyContext' as an OBJECT (never as a plain string) with these four optional fields, each a short Polish narrative line (max 1–3 sentences):
  - characterName: the in-fiction speaker / guide / NPC at this stop (e.g. "Stary Kronikarz")
  - locationIntro: what the player sees as they arrive (sensory description of the place)
  - taskNarrative: in-fiction setup that motivates the puzzle BEFORE the player solves it
  - clueRevealed: what the character tells the player AFTER they solve it (the reward + lead-in to the next location). Set unused fields to null.${cipherInstruction}

Return only the single task object in the 'task' field.`;
}

export function buildTransitionsPrompt(
  input: BlueprintPromptInput,
  outlineJson: string,
  tasksJson: string,
): string {
  return `You are a city-game designer. Build the transition graph that connects the already-generated tasks below.

Input:
${JSON.stringify(input, null, 2)}

Outline:
${outlineJson}

Tasks (already finalized):
${tasksJson}

${URBAN_DESIGN_PRINCIPLES}

Emit ONLY the 'transitions' array — do not regenerate tasks. Rules:
- LINEAR: a single chain { fromTaskIndex: null, toTaskIndex: 1 } then 1→2→…→N.
- OPEN_WORLD: a transition { fromTaskIndex: null, toTaskIndex: i } for every task index i.
- BRANCHING (multi-way fork): the number of branches must equal (endingCount − 1) — one branch per non-DEFAULT ending. Start with { fromTaskIndex: null, toTaskIndex: <fork point> } pointing to the trunk's last POI, OR if there is NO trunk emit one { fromTaskIndex: null, toTaskIndex: <branchStart> } per branch. At the fork, emit N outgoing transitions sharing the same fromTaskIndex but different toTaskIndex (the N branch start POIs), each with a distinct non-empty 'label' that names the player's choice. After the fork, each branch is its own linear chain to a leaf — DO NOT add any transition joining branches back together (no task may appear as toTaskIndex on transitions originating from more than one branch).
- MIXED: include the 'null → start' transition; route the rest as a directed graph that respects any 'unlockRequirements' chains; for MIXED, spokes return to the HUB before unlocking the next branch.
Each transition references existing task indices only. Use the 'label' field for branch labels in BRANCHING (the two labels at one fork must be distinct).`;
}

export function buildEndingsPrompt(
  input: BlueprintPromptInput,
  outlineJson: string,
  tasksJson: string,
  bible: StoryBible,
): string {
  const skeletonJson = JSON.stringify(bible.endingsSkeleton, null, 2);
  const skeletonCount = bible.endingsSkeleton.length;
  return `You are a city-game designer. FILL the endings skeleton from the story bible — do NOT invent fresh endings; complete the slots.

STORY BIBLE (authoritative):
${JSON.stringify(bible, null, 2)}

ENDINGS SKELETON TO FILL (one final ending per entry; emit them in this order):
${skeletonJson}

Input:
${JSON.stringify(input, null, 2)}

Outline:
${outlineJson}

Tasks (already finalized — read storyContext.clueRevealed to confirm which clues are planted where):
${tasksJson}

${URBAN_DESIGN_PRINCIPLES}

Use the 'submitEndings' tool. Emit EXACTLY ${skeletonCount} endings, one per skeleton entry, in skeleton order:
- ending.slug = the skeleton entry's 'label' (verbatim).
- ending.title = a short evocative phrase consistent with the skeleton 'summary' and the bible's toneAnchors.
- ending.description = 2-4 sentences expanding the skeleton 'summary' in language matching the bible's toneAnchors. Reference the questGiver / antagonist / macguffin where they fit naturally.
- ending.condition: per-flow rules below.
- ending.isDefault: exactly ONE entry across the array should be true (preferably the skeleton entry whose label includes "default" or "timeout"; otherwise the last entry).
- For each non-default ending, ensure that EVERY string in skeleton.requiredCluesPlanted has actually been planted in at least one of the tasks listed in this ending's condition.taskIndices (look it up in the tasks JSON above). If a required clue is missing, choose an alternate task that DOES carry it, or surface the gap by making this ending the DEFAULT and using condition { type: "DEFAULT" }.

Per-flow condition rules:
- LINEAR: the single skeleton entry has isDefault=true with condition { type: "DEFAULT" }.
- BRANCHING: for each non-default skeleton entry, condition = { type: "ALL_OF", taskIndices: [<indices on that branch + trunk indices that precede the fork>] }; never list tasks from a sibling branch. The default entry uses condition { type: "DEFAULT" } at the highest orderIndex.
- OPEN_WORLD / MIXED: condition is one of ALL_OF / ANY_OF / SCORE_GTE / ITEM_COLLECTED / TIMEOUT for non-default entries; exactly one is { type: "DEFAULT" }.
- 'orderIndex' is evaluated low-to-high; place the DEFAULT ending last (highest orderIndex) so it acts as the fallback.`;
}

export function buildSingleTaskPrompt(
  input: BlueprintPromptInput,
  blueprintJson: string,
  taskIndex: number,
  bible?: StoryBible,
): string {
  const bibleBlock = bible
    ? `\n\nSTORY BIBLE (authoritative — keep the regenerated task consistent with the established cast, motifs, and tone):\n${JSON.stringify(bible, null, 2)}\n\nTONE ANCHORS: ${bible.toneAnchors.join(', ')}.\nTHEMATIC MOTIFS: ${bible.thematicMotifs.join(', ')}.`
    : '';
  return `You are a city-game designer. Regenerate a single task within an existing blueprint.${bibleBlock}

Input:
${JSON.stringify(input, null, 2)}

Existing blueprint:
${blueprintJson}

${URBAN_DESIGN_PRINCIPLES}${allowedTaskTypesClause(input)}${mixedComponentsClause(input)}

Replace task with index=${taskIndex}. Keep its 'index' and (if any) coordinates' geographic plausibility. If the task previously had revealsItem or unlockRequirements that other tasks depend on, KEEP those slugs intact. Return only the single replacement task object in the 'task' field.`;
}

/** System message attached to every blueprint generator call. */
export const BLUEPRINT_SYSTEM_MESSAGE = [
  'You are an experienced urban-game designer. You produce engaging, geographically accurate, well-paced location-based exploration games.',
  'You always call the requested tool with strictly-typed JSON arguments — never reply with prose. Treat the tool schema as a hard contract.',
].join('\n');
