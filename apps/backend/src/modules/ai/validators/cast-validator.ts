import type { StoryBible } from '@citygame/shared';

export interface CastValidationIssue {
  kind:
    | 'missing_bible_quest_giver'
    | 'multiple_quest_givers'
    | 'missing_antagonist_proxy'
    | 'duplicate_voice_traits'
    | 'voice_trait_too_short'
    | 'voice_trait_too_generic'
    | 'archetype_too_generic'
    | 'importance_imbalanced'
    | 'too_many_red_herrings';
  detail?: string;
}

interface CastCharacter {
  name: string;
  archetype: string;
  roleFunction: string;
  voiceTrait: string;
  importance: number;
  era?: string | null;
}

interface CastOutput {
  characters: CastCharacter[];
}

const GENERIC_ARCHETYPE_REGEX =
  /^(stary|stara|młody|młoda|nieznajomy|nieznajoma|przechodzień|kobieta|mężczyzna|osoba|ktoś)\s*\w{0,15}$/i;

const GENERIC_VOICE_PATTERNS = [
  /^(mądry|tajemniczy|dobry|zły|miły|starszy|młodszy)( i \w+)?$/i,
  /^\w{1,15}\s+(człowiek|osoba|kobieta|mężczyzna)$/i,
];

export function validateCastConsistency(
  cast: CastOutput,
  bible: StoryBible,
): CastValidationIssue[] {
  const issues: CastValidationIssue[] = [];

  // ─── 1. Quest giver z bible musi być w obsadzie ──────────────────
  const questGivers = cast.characters.filter(
    (c) => c.roleFunction === 'QUEST_GIVER',
  );

  if (questGivers.length === 0) {
    issues.push({
      kind: 'missing_bible_quest_giver',
      detail: `expected ${bible.questGiver.name}, none found`,
    });
  } else if (questGivers.length > 1) {
    issues.push({
      kind: 'multiple_quest_givers',
      detail: `${questGivers.length} quest givers: ${questGivers.map((q) => q.name).join(', ')}`,
    });
  } else {
    const qg = questGivers[0];
    const bibleName = bible.questGiver.name.toLowerCase();
    const castName = qg.name.toLowerCase();
    if (!castName.includes(bibleName) && !bibleName.includes(castName)) {
      issues.push({
        kind: 'missing_bible_quest_giver',
        detail: `expected ${bible.questGiver.name}, got ${qg.name}`,
      });
    }
  }

  // ─── 2. Antagonist proxy gdy bible.antagonist != null ────────────
  if (bible.antagonist) {
    const proxies = cast.characters.filter(
      (c) => c.roleFunction === 'ANTAGONIST_PROXY',
    );
    if (proxies.length === 0) {
      issues.push({
        kind: 'missing_antagonist_proxy',
        detail: `bible has antagonist ${bible.antagonist.name}, no proxy in cast`,
      });
    }
  }

  // ─── 3. Voice traits — unikalne i konkretne ──────────────────────
  const traitMap = new Map<string, string[]>();
  for (const c of cast.characters) {
    const norm = c.voiceTrait.toLowerCase().trim().slice(0, 60);
    if (!traitMap.has(norm)) traitMap.set(norm, []);
    traitMap.get(norm)!.push(c.name);
  }
  for (const names of traitMap.values()) {
    if (names.length > 1) {
      issues.push({
        kind: 'duplicate_voice_traits',
        detail: `${names.join(', ')} mają identyczny voice trait`,
      });
    }
  }

  for (const c of cast.characters) {
    if (c.voiceTrait.length < 20) {
      issues.push({
        kind: 'voice_trait_too_short',
        detail: `${c.name}: "${c.voiceTrait}" (${c.voiceTrait.length} chars)`,
      });
    }
    for (const pattern of GENERIC_VOICE_PATTERNS) {
      if (pattern.test(c.voiceTrait.trim())) {
        issues.push({
          kind: 'voice_trait_too_generic',
          detail: `${c.name}: "${c.voiceTrait}"`,
        });
        break;
      }
    }
  }

  // ─── 4. Archetypy konkretne ──────────────────────────────────────
  for (const c of cast.characters) {
    const arch = c.archetype.trim();
    if (arch.length < 8 || GENERIC_ARCHETYPE_REGEX.test(arch)) {
      issues.push({
        kind: 'archetype_too_generic',
        detail: `${c.name}: "${arch}"`,
      });
    }
  }

  // ─── 5. Importance balance ───────────────────────────────────────
  const totalImportance = cast.characters.reduce(
    (sum, c) => sum + c.importance,
    0,
  );
  const avg = totalImportance / cast.characters.length;
  if (avg < 2.3 || avg > 4.2) {
    issues.push({
      kind: 'importance_imbalanced',
      detail: `avg importance ${avg.toFixed(2)} outside range 2.3-4.2`,
    });
  }

  // ─── 6. Max 1 RED_HERRING ────────────────────────────────────────
  const redHerrings = cast.characters.filter(
    (c) => c.roleFunction === 'RED_HERRING',
  );
  if (redHerrings.length > 1) {
    issues.push({
      kind: 'too_many_red_herrings',
      detail: `${redHerrings.length} red herrings: ${redHerrings.map((r) => r.name).join(', ')}`,
    });
  }

  return issues;
}
