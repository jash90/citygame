import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  blueprintInputSchema,
  gameBlueprintSchema,
  type BlueprintInput,
  type BlueprintOutline,
  type GameBlueprint,
  type StoryBible,
} from '@citygame/shared';
import { AiCredentialsService } from './ai-credentials.service';
import {
  BLUEPRINT_SYSTEM_MESSAGE,
  buildEndingsPrompt,
  buildOutlinePrompt,
  buildSingleTaskPrompt,
  buildStoryBiblePrompt,
  buildTaskForPoiPrompt,
  buildTransitionsPrompt,
  type CipherAssignment,
} from './ai-game-prompts';
import {
  buildSingleTaskFormat,
  endingsFormat,
  endingsSchema,
  outlineFormat,
  outlineSchema,
  singleTaskSchema,
  storyBibleFormat,
  storyBibleSchema,
  stripArtificialNulls,
  transitionsFormat,
  transitionsSchema,
  type EndingsToolPayload,
  type OutlineToolPayload,
  type SingleTaskPayload,
  type StoryBibleToolPayload,
  type StructuredFormat,
  type TasksToolPayload,
  type TransitionsPayload,
} from './ai-game-tools';

export class BlueprintGenerationError extends Error {
  constructor(message: string, readonly stage: string, readonly details?: unknown) {
    super(message);
    this.name = 'BlueprintGenerationError';
  }
}

@Injectable()
export class AiGameBlueprintService {
  private readonly logger = new Logger(AiGameBlueprintService.name);
  private readonly modelOverride: string | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly credentials: AiCredentialsService,
  ) {
    // Optional env-only override that lets ops pin a specific model for
    // blueprint generation distinct from the per-field AI default.
    this.modelOverride =
      this.configService.get<string>('OPENROUTER_GAME_MODEL') ?? null;
  }

  private getModel(): string {
    const base =
      this.modelOverride ?? this.credentials.getModelFor('blueprint');
    // OpenRouter's `:online` model variant runs the web-search plugin in
    // parallel with generation so the model can ground its output in current
    // facts (city legends, real POIs, coordinates). The toggle lives on the
    // global Settings page (AppSetting key `aiUseWebSearch`); admins flip it
    // once and every blueprint generation honours it. Adds latency + cost.
    return this.credentials.getUseWebSearch() ? `${base}:online` : base;
  }

  /**
   * Stage 1 of the new (post-Story-Bible) pipeline. Produces the narrative
   * skeleton (protagonist, quest giver, antagonist, macguffin, tone anchors,
   * thematic motifs, recurring cast, endings skeleton) before any other
   * stage runs. Every later stage receives this bible as authoritative
   * context so parallel per-POI calls converge on a coherent narrative.
   */
  async generateStoryBible(input: BlueprintInput): Promise<StoryBible> {
    const safeInput = blueprintInputSchema.parse(input);
    const payload = await this.callStructured<StoryBibleToolPayload>(
      'storyBible',
      buildStoryBiblePrompt(safeInput),
      storyBibleFormat,
      (raw) => storyBibleSchema.parse(raw),
    );
    return payload as StoryBible;
  }

  async generateOutline(
    input: BlueprintInput,
    bible: StoryBible,
  ): Promise<BlueprintOutline> {
    const safeInput = blueprintInputSchema.parse(input);
    // Anchor the outline to verified real-world coordinates so the model can't
    // hallucinate a city centre that's hundreds of km off, or cluster every
    // POI within a 100 m radius of an arbitrary lat/lon.
    const geo = await this.geocodeCity(safeInput.city);
    const payload = await this.callStructured<OutlineToolPayload>(
      'outline',
      buildOutlinePrompt(safeInput, geo ?? undefined, bible),
      outlineFormat,
      (raw) => outlineSchema.parse(raw),
    );
    if (geo) this.warnIfPoisOutsideBBox(safeInput.city, payload.pois, geo);
    return payload as BlueprintOutline;
  }

  /**
   * OpenStreetMap Nominatim geocoder. Free, no API key, ~1 req/sec rate
   * limit. Required User-Agent identifies the project per their policy.
   * Returns null on network / not-found so the caller falls back to the
   * unanchored prompt.
   */
  private async geocodeCity(city: string): Promise<CityGeocode | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'CityGame/1.0 (https://citygame.pl)',
          'Accept-Language': 'pl,en',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        this.logger.warn(`Geocode HTTP ${res.status} for "${city}"`);
        return null;
      }
      const data = (await res.json()) as Array<{
        lat: string;
        lon: string;
        boundingbox?: [string, string, string, string];
      }>;
      const first = data?.[0];
      if (!first?.boundingbox) {
        this.logger.warn(`Geocode found no result for "${city}"`);
        return null;
      }
      const [south, north, west, east] = first.boundingbox.map((v) =>
        parseFloat(v),
      );
      const result: CityGeocode = {
        centerLat: parseFloat(first.lat),
        centerLon: parseFloat(first.lon),
        bbox: { south, north, west, east },
      };
      this.logger.log(
        `Geocoded "${city}" → center=(${result.centerLat.toFixed(4)}, ${result.centerLon.toFixed(4)}) bbox=[${south.toFixed(4)}, ${north.toFixed(4)}, ${west.toFixed(4)}, ${east.toFixed(4)}]`,
      );
      return result;
    } catch (error) {
      this.logger.warn(
        `Geocode lookup failed for "${city}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private warnIfPoisOutsideBBox(
    city: string,
    pois: BlueprintOutline['pois'],
    geo: CityGeocode,
  ): void {
    // Allow a small overshoot — the bbox is the city polygon, but POIs on the
    // immediate outskirts (e.g. a hilltop ruin, a forest shrine) may sit just
    // outside. 0.02° ≈ 2 km of latitude, ~1.4 km of longitude at 50°N.
    const PAD = 0.02;
    const offending = pois.filter(
      (p) =>
        p.latitude < geo.bbox.south - PAD ||
        p.latitude > geo.bbox.north + PAD ||
        p.longitude < geo.bbox.west - PAD ||
        p.longitude > geo.bbox.east + PAD,
    );
    if (offending.length > 0) {
      this.logger.warn(
        `Outline for "${city}" produced ${offending.length} POI(s) outside the geocoded bbox: ${offending
          .map((p) => `#${p.index}=(${p.latitude.toFixed(4)},${p.longitude.toFixed(4)})`)
          .join(', ')}`,
      );
    }
  }

  async generateTasks(
    input: BlueprintInput,
    outline: BlueprintOutline,
    bible: StoryBible,
  ): Promise<TasksToolPayload> {
    const safeInput = blueprintInputSchema.parse(input);
    const outlineJson = JSON.stringify(outline, null, 2);
    const cipherByPoiIndex = this.planCipherChains(outline);
    // Narrow the JSON Schema's `type` enum to the admin-allowed set so the
    // structured-output API rejects disallowed types at generation time.
    const taskFormat = buildSingleTaskFormat(safeInput.allowedTaskTypes);

    // Generate one task per POI in parallel — small, focused calls instead of
    // one mega call that asks the model for the entire task array. This keeps
    // every response well under any token cap and lets a single bad response
    // be retried in isolation. Cipher source/lock pairs are pre-assigned
    // matching slugs+values here so parallel calls stay consistent. The bible
    // and the matching outline POI (with its narrativeBeat /
    // recurringCharacterIds / plantedClues) are folded into each per-POI
    // prompt so parallel calls converge on the same cast and motifs.
    const taskResults = await Promise.all(
      outline.pois.map((poi) =>
        this.callStructured<SingleTaskPayload>(
          `task#${poi.index}`,
          buildTaskForPoiPrompt(
            safeInput,
            outlineJson,
            poi.index,
            cipherByPoiIndex.get(poi.index),
            bible,
            poi,
          ),
          taskFormat,
          (raw) => singleTaskSchema.parse(raw),

        ),
      ),
    );
    const tasks = taskResults
      .map((r) => r.task)
      .sort((a, b) => a.index - b.index);

    // Transitions are a small graph — emit them in a separate call now that
    // the tasks are finalized so the model only has to think about wiring.
    const transitionsPayload = await this.callStructured<TransitionsPayload>(
      'transitions',
      buildTransitionsPrompt(
        safeInput,
        outlineJson,
        JSON.stringify(tasks, null, 2),
      ),
      transitionsFormat,
      (raw) => transitionsSchema.parse(raw),

    );

    return { tasks, transitions: transitionsPayload.transitions };
  }

  async generateEndings(
    input: BlueprintInput,
    outline: BlueprintOutline,
    tasks: TasksToolPayload,
    bible: StoryBible,
  ): Promise<EndingsToolPayload> {
    const safeInput = blueprintInputSchema.parse(input);
    return this.callStructured<EndingsToolPayload>(
      'endings',
      buildEndingsPrompt(
        safeInput,
        JSON.stringify(outline, null, 2),
        JSON.stringify(tasks, null, 2),
        bible,
      ),
      endingsFormat,
      (raw) => endingsSchema.parse(raw),

    );
  }

  async generateGameBlueprint(input: BlueprintInput): Promise<GameBlueprint> {
    // Story Bible runs FIRST so every later stage reads a single coherent
    // narrative skeleton (cast, motifs, tone, endings skeleton) instead of
    // each call re-inventing one.
    const bible = await this.generateStoryBible(input);
    const outline = await this.generateOutline(input, bible);
    const tasks = await this.generateTasks(input, outline, bible);
    const endings = await this.generateEndings(input, outline, tasks, bible);

    const blueprint: GameBlueprint = {
      title: outline.title,
      description: outline.description,
      city: outline.city,
      flowType: outline.flowType,
      language: input.language,
      theme: outline.theme,
      prologue: outline.prologue,
      storyBible: bible,
      tasks: tasks.tasks,
      transitions: tasks.transitions,
      endings: this.ensureSingleDefaultEnding(endings.endings),
    };

    const result = gameBlueprintSchema.safeParse(blueprint);
    if (!result.success) {
      this.logger.warn(
        `Blueprint validation failed: ${JSON.stringify(result.error.flatten())}`,
      );
      throw new BlueprintGenerationError(
        'Generated blueprint failed schema validation',
        'compose',
        result.error.flatten(),
      );
    }
    return result.data as GameBlueprint;
  }

  async regenerateTask(
    input: BlueprintInput,
    blueprint: GameBlueprint,
    taskIndex: number,
  ): Promise<GameBlueprint> {
    const safeInput = blueprintInputSchema.parse(input);
    const taskFormat = buildSingleTaskFormat(safeInput.allowedTaskTypes);
    // Pass through the bible if the blueprint already carries one (post v2
    // generations); legacy blueprints without a bible regenerate without the
    // extra context — the prompt builder makes that block optional.
    const payload = await this.callStructured<SingleTaskPayload>(
      `regenerate-task#${taskIndex}`,
      buildSingleTaskPrompt(
        safeInput,
        JSON.stringify(blueprint, null, 2),
        taskIndex,
        blueprint.storyBible as StoryBible | undefined,
      ),
      taskFormat,
      (raw) => singleTaskSchema.parse(raw),

    );

    const replaced = payload.task;
    if (replaced.index !== taskIndex) {
      throw new BlueprintGenerationError(
        `AI returned task with index=${replaced.index}, expected ${taskIndex}`,
        'task',
      );
    }
    const next: GameBlueprint = {
      ...blueprint,
      tasks: blueprint.tasks.map((t) => (t.index === taskIndex ? replaced : t)),
    };
    const result = gameBlueprintSchema.safeParse(next);
    if (!result.success) {
      throw new BlueprintGenerationError(
        'Updated blueprint failed schema validation after task regeneration',
        'task',
        result.error.flatten(),
      );
    }
    return result.data as GameBlueprint;
  }

  async regenerateEndings(
    input: BlueprintInput,
    blueprint: GameBlueprint,
  ): Promise<GameBlueprint> {
    const outline = blueprintToOutline(blueprint);
    const tasks: TasksToolPayload = {
      tasks: blueprint.tasks,
      transitions: blueprint.transitions,
    };
    // Endings are now generated against the bible's `endingsSkeleton`. Legacy
    // blueprints that pre-date v2 don't carry a bible — synthesize one
    // just-in-time so the prompt has a skeleton to fill, and persist it back
    // on the result so subsequent regenerations stay consistent.
    const bible: StoryBible =
      (blueprint.storyBible as StoryBible | undefined) ??
      (await this.generateStoryBible(input));
    const endings = await this.generateEndings(input, outline, tasks, bible);
    const next: GameBlueprint = {
      ...blueprint,
      storyBible: bible,
      endings: endings.endings,
    };
    const result = gameBlueprintSchema.safeParse(next);
    if (!result.success) {
      throw new BlueprintGenerationError(
        'Updated blueprint failed schema validation after endings regeneration',
        'endings',
        result.error.flatten(),
      );
    }
    return result.data as GameBlueprint;
  }

  private async callStructured<T>(
    stage: string,
    userPrompt: string,
    format: StructuredFormat,
    parse: (raw: unknown) => T,
  ): Promise<T> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: BLUEPRINT_SYSTEM_MESSAGE },
      { role: 'user', content: userPrompt },
    ];

    const first = await this.runStructuredCall(messages, format);
    const firstParsed = this.tryParse(first, format, parse);
    if (firstParsed.kind === 'ok') return firstParsed.value;

    this.logger.warn(
      `Stage "${stage}" failed on first attempt (${firstParsed.reason}); retrying with feedback`,
    );
    const retryMessages: ChatCompletionMessageParam[] = [
      ...messages,
      first.assistantMessage,
      { role: 'user', content: this.buildRetryPrompt(firstParsed) },
    ];

    const second = await this.runStructuredCall(retryMessages, format);
    const secondParsed = this.tryParse(second, format, parse);
    if (secondParsed.kind === 'ok') return secondParsed.value;

    this.logger.error(
      `Stage "${stage}" failed after retry. firstReason=${firstParsed.reason} secondReason=${secondParsed.reason} detail=${secondParsed.detail}`,
    );
    throw new BlueprintGenerationError(
      `AI structured-output call for stage "${stage}" failed after retry (${secondParsed.reason}): ${secondParsed.detail}`,
      stage,
      secondParsed.detail,
    );
  }

  /**
   * Combines the JSON-parse and Zod-validation steps into a single result so
   * `callStructured` can apply one retry loop to both failure modes. With
   * structured outputs the JSON-parse failure should be rare (the API enforces
   * the JSON Schema during generation), but length-truncation can still emit
   * incomplete JSON, and Zod still enforces count/range constraints we strip
   * before sending the schema to the model.
   */
  private tryParse<T>(
    result: StructuredCallResult,
    format: StructuredFormat,
    parse: (raw: unknown) => T,
  ):
    | { kind: 'ok'; value: T }
    | { kind: 'fail'; reason: 'json' | 'schema'; detail: string } {
    if (result.kind === 'parse_error') {
      return { kind: 'fail', reason: 'json', detail: result.parseError };
    }
    try {
      const cleaned = stripArtificialNulls(
        result.payload,
        format.artificialNullPaths,
      );
      return { kind: 'ok', value: parse(cleaned) };
    } catch (error) {
      return {
        kind: 'fail',
        reason: 'schema',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildRetryPrompt(failure: {
    reason: 'json' | 'schema';
    detail: string;
  }): string {
    const fullPayloadReminder =
      'Re-emit the FULL response exactly as you intended originally — do not return a placeholder or empty object. Every required field must be present and complete.';
    if (failure.reason === 'json') {
      return `Your previous response was not valid JSON (likely truncated). Parse error:\n${failure.detail}\n\n${fullPayloadReminder} Be concise inside string values to fit the token budget.`;
    }
    return `Your previous response did not match the requested constraints. Validation error:\n${failure.detail}\n\n${fullPayloadReminder} Pay attention to required item counts and value ranges from the user prompt.`;
  }

  private async runStructuredCall(
    messages: ChatCompletionMessageParam[],
    format: StructuredFormat,
  ): Promise<StructuredCallResult> {
    // OpenRouter forwards `response_format.type: 'json_schema'` to Anthropic
    // and auto-applies the `anthropic-beta: structured-outputs-2025-11-13`
    // header, so generation is constrained to our schema token-by-token.
    // Pass only the wire fields — `artificialNullPaths` is internal metadata.
    let response;
    try {
      response = await this.credentials
        .getClient()
        .chat.completions.create({
          model: this.getModel(),
          messages,
          response_format: {
            type: format.type,
            json_schema: format.json_schema,
          },
          temperature: 0.4,
          max_tokens: 16384,
        });
    } catch (error) {
      if (isInsufficientCreditsError(error)) {
        this.logger.error(
          `OpenRouter rejected ${format.json_schema.name}: account out of credits.`,
        );
        throw new BlueprintGenerationError(
          'OpenRouter: na koncie nie ma wystarczających kredytów. Doładuj konto na https://openrouter.ai/settings/credits, a następnie spróbuj ponownie.',
          'credits',
          'AI_CREDITS_INSUFFICIENT',
        );
      }
      throw error;
    }

    const choice = response.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== 'string' || !content) {
      const finishReason = choice?.finish_reason ?? 'unknown';
      this.logger.error(
        `${format.json_schema.name} returned no content. finish_reason=${finishReason}.`,
      );
      throw new BlueprintGenerationError(
        `AI returned no content for ${format.json_schema.name} (finish_reason=${finishReason})`,
        format.json_schema.name,
      );
    }

    const assistantMessage: ChatCompletionMessageParam = {
      role: 'assistant',
      content,
    };

    try {
      const payload = JSON.parse(content) as unknown;
      return { kind: 'ok', payload, assistantMessage };
    } catch (error) {
      const parseError =
        error instanceof Error ? error.message : String(error);
      const finishReason = choice?.finish_reason ?? 'unknown';
      const truncated = finishReason === 'length';
      this.logger.warn(
        `Non-JSON content for ${format.json_schema.name} (finish_reason=${finishReason}${truncated ? ', output likely truncated' : ''}): ${parseError}. Raw (truncated): ${content.slice(0, 800)}`,
      );
      return {
        kind: 'parse_error',
        parseError: truncated
          ? `${parseError} (model output was truncated by max_tokens)`
          : parseError,
        assistantMessage,
      };
    }
  }

  /**
   * Pairs each CIPHER_SOURCE POI with one CIPHER_LOCK POI from the outline and
   * pre-assigns a stable slug + plaintext value the model will copy verbatim.
   * Without this, parallel per-POI generation invents independent slug names
   * and the lock's `requiresItem` never matches a source's `revealsItem.slug`,
   * which the final `gameBlueprintSchema` rejects.
   *
   * Pairing strategy: outline order. Source[i] pairs with Lock[i]; extra
   * sources or locks (mismatched counts) are skipped so the model can fall
   * back to its own choice for those POIs.
   */
  private planCipherChains(
    outline: BlueprintOutline,
  ): Map<number, CipherAssignment> {
    const assignments = new Map<number, CipherAssignment>();
    const sources = outline.pois.filter((p) => p.role === 'CIPHER_SOURCE');
    const locks = outline.pois.filter((p) => p.role === 'CIPHER_LOCK');
    const pairCount = Math.min(sources.length, locks.length);
    const VALUE_POOL = [
      'AURUM',
      'CORVUS',
      'NOVA',
      'SILEX',
      'TEMPUS',
      'VENTUS',
    ];
    for (let i = 0; i < pairCount; i++) {
      const slug = `cipher_chain_${i + 1}`;
      const value = VALUE_POOL[i % VALUE_POOL.length];
      const label = `Klucz ${i + 1}`;
      assignments.set(sources[i].index, {
        role: 'CIPHER_SOURCE',
        slug,
        value,
        kind: 'WORD',
        label,
      });
      assignments.set(locks[i].index, {
        role: 'CIPHER_LOCK',
        slug,
        value,
        kind: 'WORD',
        label,
      });
    }
    if (assignments.size > 0) {
      this.logger.log(
        `Cipher plan: ${pairCount} pair(s) — ${[...assignments.entries()]
          .map(([i, a]) => `poi#${i}=${a.role}(${a.slug}=${a.value})`)
          .join(', ')}`,
      );
    }
    return assignments;
  }

  /**
   * The blueprint schema requires exactly one ending with `isDefault=true`.
   * Models routinely emit zero or two — normalize deterministically:
   *   - prefer the ending whose `condition.type === 'DEFAULT'`,
   *   - else mark the highest-orderIndex ending as the default,
   *   - and unset `isDefault` on every other ending.
   */
  private ensureSingleDefaultEnding(
    endings: EndingsToolPayload['endings'],
  ): EndingsToolPayload['endings'] {
    if (endings.length === 0) return endings;
    let chosenIndex = endings.findIndex(
      (e) => e.condition?.type === 'DEFAULT',
    );
    if (chosenIndex === -1) {
      chosenIndex = endings.findIndex((e) => e.isDefault);
    }
    if (chosenIndex === -1) {
      chosenIndex = endings.length - 1;
    }
    return endings.map((e, i) => ({ ...e, isDefault: i === chosenIndex }));
  }
}

type StructuredCallResult =
  | { kind: 'ok'; payload: unknown; assistantMessage: ChatCompletionMessageParam }
  | { kind: 'parse_error'; parseError: string; assistantMessage: ChatCompletionMessageParam };

/**
 * The OpenAI SDK throws `OpenAI.APIError` whose `.status` matches the upstream
 * HTTP code. OpenRouter returns 402 with a "requires more credits" message
 * when the account is out of credits. Detect either signal so we can surface
 * a friendly, actionable error to the admin instead of the raw provider body.
 */
function isInsufficientCreditsError(error: unknown): boolean {
  const err = error as { status?: number; code?: number; message?: string };
  if (err?.status === 402 || err?.code === 402) return true;
  const msg = typeof err?.message === 'string' ? err.message.toLowerCase() : '';
  return (
    msg.includes('requires more credits') ||
    msg.includes('insufficient_credits') ||
    msg.includes('402')
  );
}

function blueprintToOutline(bp: GameBlueprint): BlueprintOutline {
  return {
    title: bp.title,
    description: bp.description,
    city: bp.city,
    flowType: bp.flowType,
    theme: bp.theme,
    prologue: bp.prologue,
    pois: bp.tasks.map((t) => ({
      index: t.index,
      name: t.title,
      latitude: t.latitude,
      longitude: t.longitude,
      role: 'PUZZLE',
      summary: t.description.slice(0, 240),
    })),
    endingHints: bp.endings.map((e) => ({
      slug: e.slug,
      title: e.title,
      flavour: e.description.slice(0, 240),
    })),
  };
}

interface CityGeocode {
  centerLat: number;
  centerLon: number;
  bbox: { south: number; north: number; west: number; east: number };
}
