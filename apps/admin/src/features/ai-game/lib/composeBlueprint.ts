/**
 * Pure helpers that fold the orchestrator's per-stage data into the shape the
 * existing wizard step components and the `/api/admin/games/from-blueprint`
 * endpoint expect.
 *
 * Two flavours:
 *   - `composePartialBlueprint` is permissive: it returns whatever slices are
 *     available so `BlueprintOutlineView`, `BlueprintTasksList`, etc. can
 *     render a live preview as stages land.
 *   - `composeBlueprint` is strict: it returns a fully-typed `GameBlueprint`
 *     only when every slice is present AND `gameBlueprintSchema.safeParse`
 *     succeeds. Save is gated on this.
 */
import {
  gameBlueprintSchema,
  type BlueprintEnding,
  type BlueprintInput,
  type BlueprintOutline,
  type BlueprintTask,
  type BlueprintTransition,
  type GameBlueprint,
  type StoryBible,
} from '@citygame/shared';

export interface OrchestratorData {
  input: BlueprintInput;
  bible?: StoryBible;
  outline?: BlueprintOutline;
  tasks: Record<number, BlueprintTask>;
  transitions?: BlueprintTransition[];
  endings?: BlueprintEnding[];
}

export function composePartialBlueprint(
  data: OrchestratorData,
): Partial<GameBlueprint> {
  const tasks = Object.values(data.tasks).sort((a, b) => a.index - b.index);
  return {
    title: data.outline?.title,
    description: data.outline?.description,
    city: data.outline?.city ?? data.input.city,
    flowType: data.outline?.flowType ?? data.input.flowType,
    language: data.input.language,
    theme: data.outline?.theme ?? data.input.theme,
    prologue: data.outline?.prologue,
    storyBible: data.bible,
    tasks,
    transitions: data.transitions ?? [],
    endings: data.endings ?? [],
  };
}

/**
 * Returns the typed blueprint only when every slice is present (bible,
 * outline, every task in `outline.pois`, transitions, endings) AND the
 * combined object passes the cross-cutting Zod superRefine in
 * `gameBlueprintSchema` (cipher chain integrity, MIXED step counts, etc.).
 * Returns `null` otherwise so the save button can stay disabled.
 */
export function composeBlueprint(data: OrchestratorData): GameBlueprint | null {
  if (!data.bible || !data.outline || !data.transitions || !data.endings) {
    return null;
  }
  const tasks = Object.values(data.tasks).sort((a, b) => a.index - b.index);
  // Require one task per outline POI — the fan-out is N=outline.pois.length
  // and the orchestrator only fires `transitions`/`endings` once every POI's
  // task has resolved, so this should hold whenever the strict gate passes.
  if (tasks.length !== data.outline.pois.length) return null;

  const candidate = {
    title: data.outline.title,
    description: data.outline.description,
    city: data.outline.city,
    flowType: data.outline.flowType,
    language: data.input.language,
    theme: data.outline.theme,
    prologue: data.outline.prologue,
    storyBible: data.bible,
    tasks,
    transitions: data.transitions,
    endings: data.endings,
  };

  const result = gameBlueprintSchema.safeParse(candidate);
  return result.success ? (result.data as GameBlueprint) : null;
}
