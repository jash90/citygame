import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  blueprintInputSchema,
  gameBlueprintSchema,
  type BlueprintCast,
  type BlueprintInput,
  type BlueprintOutline,
  type BlueprintTask,
  type BlueprintTransition,
  type GameBlueprint,
  type StoryBible,
} from '@citygame/shared';
import { AiCredentialsService } from './ai-credentials.service';
import {
  BLUEPRINT_SYSTEM_MESSAGE,
  buildCastPrompt,
  buildEndingsPrompt,
  buildOutlinePrompt,
  buildResearchPrompt,
  buildSingleTaskPrompt,
  buildStoryBiblePrompt,
  buildTaskForPoiPrompt,
  buildTransitionsPrompt,
  type CipherAssignment,
} from './ai-game-prompts';
import {
  buildSingleTaskFormat,
  castFormat,
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
  type CastToolPayload,
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

/**
 * Tiers of response-format support, ordered most-strict → most-permissive.
 *
 * - `json_schema`: OpenAI Structured Outputs / Anthropic structured-outputs —
 *   the API constrains generation token-by-token to our JSON Schema. Used by
 *   default for OpenAI direct + OpenRouter (which forwards to Anthropic);
 *   this is what the prompt and Zod schemas were designed for.
 * - `json_object`: model only guarantees the response is valid JSON, schema
 *   is enforced post-hoc by Zod. Used as fallback when an OpenRouter-routed
 *   model rejects `json_schema`; we add the schema text into the user prompt
 *   so the model knows the expected shape.
 * - `text`: no `response_format` at all. The user prompt instructs JSON-only
 *   output and embeds the schema; we extract the first JSON object from the
 *   response (markdown fences, prose, citations are stripped). Last resort
 *   for models that 400 on any `response_format` argument.
 */
export type ResponseFormatTier = 'json_schema' | 'json_object' | 'text';

@Injectable()
export class AiGameBlueprintService {
  private readonly logger = new Logger(AiGameBlueprintService.name);
  private readonly modelOverride: string | null;
  /**
   * Detected response-format support per model id. Lazy-filled on first
   * unsupported-error response from a stage call. Cleared whenever the
   * provider changes (OpenAI direct and OpenRouter may both expose models
   * named `gpt-5` etc., but the structured-output capability isn't
   * transferable across providers).
   */
  private readonly responseFormatTier = new Map<string, ResponseFormatTier>();
  /**
   * Detected per-model preference for the token-limit parameter name:
   * - `max_tokens`: legacy / Anthropic via OpenRouter / older OpenAI
   * - `max_completion_tokens`: gpt-5, gpt-4.1, o1, o3 (OpenAI rejects the
   *   legacy name with HTTP 400 `unsupported_parameter`)
   * Defaults to `max_tokens`; flipped to `max_completion_tokens` on first
   * matching error and cached so subsequent stages skip the doomed name.
   */
  private readonly tokenParamCache = new Map<
    string,
    'max_tokens' | 'max_completion_tokens'
  >();
  /**
   * Per-model set of request parameters that the provider rejected with an
   * `unsupported_value` / `unsupported_parameter` error and that we therefore
   * skip on subsequent calls. OpenAI's reasoning + flagship models (gpt-5,
   * gpt-4.1, o1, o3) lock several knobs to defaults — `temperature`, `top_p`,
   * `presence_penalty`, `frequency_penalty` — and 400 on any custom value.
   * We discover these lazily from error messages instead of hardcoding a
   * model whitelist that would go stale every release.
   */
  private readonly strippedParams = new Map<string, Set<string>>();

  constructor(
    private readonly configService: ConfigService,
    private readonly credentials: AiCredentialsService,
  ) {
    // Optional env-only override that lets ops pin a specific model for
    // blueprint generation distinct from the per-field AI default.
    this.modelOverride =
      this.configService.get<string>('OPENROUTER_GAME_MODEL') ?? null;
    // Defensive: the existing unit test mocks `AiCredentialsService` with a
    // bare object that doesn't implement `onProviderChange`. Real DI always
    // injects the full service.
    this.credentials.onProviderChange?.(() => {
      this.responseFormatTier.clear();
      this.tokenParamCache.clear();
      this.strippedParams.clear();
    });
  }

  /**
   * Returns the model id used by every structured-output stage. We
   * deliberately do NOT append `:online` here anymore — when web search is
   * enabled, a single `:online` call runs once at the start of the pipeline
   * (see `gatherResearchPack`) and its output is injected into the prompts of
   * downstream stages. This avoids 7–8× latency + 7–8× empty-content risk.
   */
  private getModel(): string {
    return this.modelOverride ?? this.credentials.getModelFor('blueprint');
  }

  /** Model id used for the one-time `:online` web-search research call. */
  private getOnlineResearchModel(): string {
    return `${this.getModel()}:online`;
  }

  /**
   * Runs ONE `:online` web-search call up front when the admin has enabled
   * web search globally, and returns a compact factual brief about the city +
   * theme that subsequent stages weave into their prompts. Returns `null`
   * when web search is disabled or when the research call fails — the
   * pipeline must keep working without web grounding.
   *
   * Public so the stage-by-stage HTTP controller can call it as its own
   * endpoint; legacy `generateGameBlueprint` still calls it inline.
   */
  async gatherResearchPack(
    input: BlueprintInput,
  ): Promise<string | null> {
    if (!this.credentials.getUseWebSearch()) return null;
    const model = this.getOnlineResearchModel();
    const startedAt = Date.now();
    try {
      const response = await this.credentials
        .getClient()
        .chat.completions.create(
          {
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are a research assistant for a city-exploration game designer. Use web search to gather factual, locally-sourced ground truth about the requested city + theme. Output ONLY the brief — no preamble, no citations, no markdown formatting beyond simple line breaks. Keep it concise (≤300 words) so it fits inside downstream prompts.',
              },
              {
                role: 'user',
                content: buildResearchPrompt(input),
              },
            ],
            temperature: 0.2,
            // OpenRouter's :online plugin consumes a large hidden budget for the
            // search/reasoning step before any visible text is produced. With
            // 1024 tokens the visible response was empty (finish_reason=length).
            // Give it real headroom; we still cap the injected pack at 2000
            // chars so downstream prompts don't bloat.
            max_tokens: 4096,
          },
          // Cap research-pack latency so a broken :online plugin doesn't hold
          // the whole pipeline for 5 minutes per attempt. Failure here is
          // non-fatal — downstream stages run without web context.
          { timeout: 90_000 },
        );
      const text = response.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) {
        const finishReason = response.choices?.[0]?.finish_reason ?? 'unknown';
        this.logger.warn(
          `research pack unavailable, proceeding without web context (empty response, finish_reason=${finishReason})`,
        );
        return null;
      }
      const trimmed = text.trim();
      // Cap injected length so the research pack doesn't bloat every
      // downstream prompt to the point of crowding out the actual schema +
      // bible context.
      const capped =
        trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}\n…[truncated]` : trimmed;
      this.logger.log(
        `research pack ready (${capped.length} chars, ${Date.now() - startedAt} ms, model=${model})`,
      );
      return capped;
    } catch (error) {
      this.logger.warn(
        `research pack unavailable, proceeding without web context (error: ${error instanceof Error ? error.message : String(error)})`,
      );
      return null;
    }
  }

  /**
   * Stage 1 of the new (post-Story-Bible) pipeline. Produces the narrative
   * skeleton (protagonist, quest giver, antagonist, macguffin, tone anchors,
   * thematic motifs, recurring cast, endings skeleton) before any other
   * stage runs. Every later stage receives this bible as authoritative
   * context so parallel per-POI calls converge on a coherent narrative.
   */
  async generateStoryBible(
    input: BlueprintInput,
    researchPack?: string | null,
  ): Promise<StoryBible> {
    const safeInput = blueprintInputSchema.parse(input);
    const payload = await this.callStructured<StoryBibleToolPayload>(
      'storyBible',
      buildStoryBiblePrompt(safeInput, researchPack ?? undefined),
      storyBibleFormat,
      (raw) => storyBibleSchema.parse(raw),
    );
    return payload as StoryBible;
  }

  /**
   * Cast stage: produces 2-7 NPC characters for the game.
   * Only called when storyMode is 'FLAVOR'. The cast is forwarded to
   * outline and tasks stages so all stages agree on who the NPCs are.
   */
  async generateCast(
    input: BlueprintInput,
    bible: StoryBible,
    researchPack?: string | null,
  ): Promise<BlueprintCast> {
    const safeInput = blueprintInputSchema.parse(input);
    // Import dynamically to avoid circular — same pattern as other stages
    const { castSchema } = await import('@citygame/shared');
    const payload = await this.callStructured<CastToolPayload>(
      'cast',
      buildCastPrompt(safeInput, bible, researchPack ?? undefined),
      castFormat,
      (raw) => {
        return { cast: castSchema.parse(raw) } as CastToolPayload;
      },
    );
    return (payload as { cast: BlueprintCast }).cast;
  }

  async generateOutline(
    input: BlueprintInput,
    bible: StoryBible,
    researchPack?: string | null,
  ): Promise<BlueprintOutline> {
    const safeInput = blueprintInputSchema.parse(input);
    // Anchor the outline to verified real-world coordinates so the model can't
    // hallucinate a city centre that's hundreds of km off, or cluster every
    // POI within a 100 m radius of an arbitrary lat/lon.
    const geo = await this.geocodeCity(safeInput.city);
    const payload = await this.callStructured<OutlineToolPayload>(
      'outline',
      buildOutlinePrompt(safeInput, geo ?? undefined, bible, researchPack ?? undefined),
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

  /**
   * Generate ONE task for ONE POI. Used both by the legacy `generateTasks`
   * Promise.all loop and by the stage-by-stage HTTP controller, which fans
   * out N parallel calls client-side so the wizard can show per-POI
   * progress + retries instead of an all-or-nothing batch.
   *
   * `cipherAssignment` (when present) overrides the per-POI cipher fields
   * with the deterministic slug + value chosen by `planCipherChains` on the
   * locked outline. The orchestrator MUST forward the same plan to every
   * POI call to keep CIPHER_SOURCE/LOCK pairs consistent.
   */
  async generateTaskForPoi(
    input: BlueprintInput,
    outline: BlueprintOutline,
    bible: StoryBible,
    poi: BlueprintOutline['pois'][number],
    cipherAssignment?: CipherAssignment,
    researchPack?: string | null,
    cast?: BlueprintCast,
  ): Promise<BlueprintTask> {
    const safeInput = blueprintInputSchema.parse(input);
    const taskFormat = buildSingleTaskFormat(safeInput.allowedTaskTypes);
    const payload = await this.callStructured<SingleTaskPayload>(
      `task#${poi.index}`,
      buildTaskForPoiPrompt(
        safeInput,
        JSON.stringify(outline, null, 2),
        poi.index,
        cipherAssignment,
        bible,
        poi,
        researchPack ?? undefined,
        cast,
      ),
      taskFormat,
      (raw) => singleTaskSchema.parse(raw),
    );
    return payload.task;
  }

  /**
   * Generate the transition graph from a finalized task list. Split out from
   * `generateTasks` so the stage-by-stage controller can call it as its own
   * endpoint after all per-POI tasks have resolved.
   */
  async generateTransitions(
    input: BlueprintInput,
    outline: BlueprintOutline,
    tasks: BlueprintTask[],
  ): Promise<BlueprintTransition[]> {
    const safeInput = blueprintInputSchema.parse(input);
    const transitionsPayload = await this.callStructured<TransitionsPayload>(
      'transitions',
      buildTransitionsPrompt(
        safeInput,
        JSON.stringify(outline, null, 2),
        JSON.stringify(tasks, null, 2),
      ),
      transitionsFormat,
      (raw) => transitionsSchema.parse(raw),
    );
    return transitionsPayload.transitions;
  }

  /**
   * Compose the per-POI task fan-out + transition graph into the shape the
   * legacy monolithic pipeline expects. Kept as a thin wrapper so the
   * existing unit spec keeps working; the new stage-by-stage controller
   * does NOT call this — it fans out per-POI calls itself for live UI.
   */
  async generateTasks(
    input: BlueprintInput,
    outline: BlueprintOutline,
    bible: StoryBible,
    researchPack?: string | null,
    cast?: BlueprintCast,
  ): Promise<TasksToolPayload> {
    const cipherByPoiIndex = this.planCipherChains(outline);
    const taskResults = await Promise.all(
      outline.pois.map((poi) =>
        this.generateTaskForPoi(
          input,
          outline,
          bible,
          poi,
          cipherByPoiIndex[poi.index],
          researchPack ?? undefined,
          cast,
        ),
      ),
    );
    const tasks = taskResults.sort((a, b) => a.index - b.index);
    const transitions = await this.generateTransitions(input, outline, tasks);
    return { tasks, transitions };
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
    // One-time `:online` web-search call (when admin has enabled it) feeds
    // ground-truth city facts into the prompts of every later stage so the
    // model isn't guessing legends and POI names. The pipeline itself runs
    // OFFLINE — no per-stage `:online` — to keep latency + empty-response
    // risk bounded.
    const researchPack = await this.gatherResearchPack(input);

    // Story Bible runs FIRST (after the research pack, when present) so every
    // later stage reads a single coherent narrative skeleton (cast, motifs,
    // tone, endings skeleton) instead of each call re-inventing one.
    const bible = await this.generateStoryBible(input, researchPack);

    // Cast stage runs after storyBible when storyMode is FLAVOR.
    // Produces Character entities that outline + tasks stages reference.
    let cast: BlueprintCast | undefined;
    if (input.storyMode === 'FLAVOR') {
      try {
        cast = await this.generateCast(input, bible, researchPack);
        this.logger.log(`Cast stage produced ${cast.characters.length} characters`);
      } catch (err) {
        this.logger.warn(`Cast stage failed, proceeding without cast: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const outline = await this.generateOutline(input, bible, researchPack);
    const tasks = await this.generateTasks(input, outline, bible, researchPack, cast);
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
      cast,
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
    // Legacy blueprints (pre-bible) synthesize a bible just-in-time so the
    // prompt has narrative context to fill, then persist it back on the
    // result so subsequent regenerations stay consistent with one cast.
    const bible: StoryBible =
      (blueprint.storyBible as StoryBible | undefined) ??
      (await this.generateStoryBible(safeInput));
    const payload = await this.callStructured<SingleTaskPayload>(
      `regenerate-task#${taskIndex}`,
      buildSingleTaskPrompt(
        safeInput,
        JSON.stringify({ ...blueprint, storyBible: bible }, null, 2),
        taskIndex,
        bible,
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
      storyBible: bible,
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

  /**
   * Builds the chat-completion request for a given tier. For tiers below
   * `json_schema` the schema is embedded in the user prompt so the model
   * has a chance to match its shape, and a hard "JSON only, no prose"
   * directive is appended.
   *
   * `tokenParam` flips between `max_tokens` (legacy / OpenRouter Anthropic /
   * older OpenAI) and `max_completion_tokens` (gpt-5, gpt-4.1, o1, o3 —
   * OpenAI rejects the legacy name with HTTP 400 `unsupported_parameter`).
   * The runStructuredCall catch block detects that error, caches the model's
   * preference, and retries.
   */
  private buildChatRequest(
    model: string,
    messages: ChatCompletionMessageParam[],
    format: StructuredFormat,
    tier: ResponseFormatTier,
    tokenParam: 'max_tokens' | 'max_completion_tokens',
    stripped: Set<string>,
  ): Parameters<
    ReturnType<AiCredentialsService['getClient']>['chat']['completions']['create']
  >[0] {
    type ChatRequest = Parameters<
      ReturnType<AiCredentialsService['getClient']>['chat']['completions']['create']
    >[0];
    const base: ChatRequest = {
      model,
      messages: tier === 'json_schema' ? messages : appendJsonHint(messages, format, tier),
      [tokenParam]: 16384,
    } as ChatRequest;
    // OpenAI's reasoning models (gpt-5, gpt-4.1, o1, o3) lock `temperature`,
    // `top_p`, etc. to defaults; only attach the knob when the model hasn't
    // already 400'd on it.
    if (!stripped.has('temperature')) {
      (base as ChatRequest & { temperature?: number }).temperature = 0.4;
    }

    if (tier === 'json_schema') {
      return {
        ...base,
        response_format: {
          type: format.type,
          json_schema: format.json_schema,
        },
      };
    }
    if (tier === 'json_object') {
      return {
        ...base,
        response_format: { type: 'json_object' },
      };
    }
    // tier === 'text': no response_format at all — the prompt addendum is the
    // only thing pushing the model toward JSON output.
    return base;
  }

  private async runStructuredCall(
    messages: ChatCompletionMessageParam[],
    format: StructuredFormat,
  ): Promise<StructuredCallResult> {
    // Pick the most-strict tier the model is known to support. On the first
    // call for a model we always START at `json_schema` (best quality); if
    // the API rejects it we cache the next-best tier and retry. Subsequent
    // calls skip the doomed tier entirely.
    const model = this.getModel();
    let tier: ResponseFormatTier =
      this.responseFormatTier.get(model) ?? 'json_schema';
    let tokenParam: 'max_tokens' | 'max_completion_tokens' =
      this.tokenParamCache.get(model) ?? 'max_tokens';
    let stripped = this.strippedParams.get(model) ?? new Set<string>();

    // OpenRouter forwards `response_format.type: 'json_schema'` to Anthropic
    // and auto-applies the `anthropic-beta: structured-outputs-2025-11-13`
    // header; OpenAI direct supports it natively. Some routes (older or
    // OSS-routed models on OpenRouter) only support `json_object` or no
    // `response_format` at all — we gracefully step down through
    // `json_object` then plain text.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any;
    while (true) {
      try {
        response = await this.credentials
          .getClient()
          .chat.completions.create(
            this.buildChatRequest(
              model,
              messages,
              format,
              tier,
              tokenParam,
              stripped,
            ),
          );
        break;
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
        if (
          tokenParam === 'max_tokens' &&
          isMaxCompletionTokensRequiredError(error)
        ) {
          this.logger.warn(
            `Model ${model} requires max_completion_tokens (modern OpenAI); switching parameter name and retrying.`,
          );
          this.tokenParamCache.set(model, 'max_completion_tokens');
          tokenParam = 'max_completion_tokens';
          continue;
        }
        const lockedParam = detectLockedParam(error);
        if (lockedParam && !stripped.has(lockedParam)) {
          this.logger.warn(
            `Model ${model} locks ${lockedParam} to its default; stripping it from subsequent calls and retrying.`,
          );
          stripped = new Set(stripped).add(lockedParam);
          this.strippedParams.set(model, stripped);
          continue;
        }
        if (isUnsupportedResponseFormatError(error) && tier !== 'text') {
          const next: ResponseFormatTier =
            tier === 'json_schema' ? 'json_object' : 'text';
          this.logger.warn(
            `Model ${model} rejected response_format=${tier} (${asErrorMessage(error)}); downgrading to ${next}`,
          );
          this.responseFormatTier.set(model, next);
          tier = next;
          continue;
        }
        throw error;
      }
    }

    const choice = response.choices?.[0];
    // OpenAI o1 / o3 reasoning models and some OpenRouter-routed reasoning
    // variants emit chain-of-thought into `message.reasoning` and leave
    // `message.content` empty (or put both there). When `content` is empty
    // but `reasoning` has text, try to extract a JSON object from the
    // reasoning trace — `extractFirstJson` already handles markdown fences
    // and surrounding prose, which is exactly what reasoning channels look
    // like.
    const messagePayload = choice?.message as
      | { content?: string | null; reasoning?: string | null }
      | undefined;
    const content =
      typeof messagePayload?.content === 'string' && messagePayload.content
        ? messagePayload.content
        : typeof messagePayload?.reasoning === 'string' &&
            messagePayload.reasoning
          ? messagePayload.reasoning
          : '';
    if (!content) {
      const finishReason = choice?.finish_reason ?? 'unknown';
      this.logger.error(
        `${format.json_schema.name} returned no content. finish_reason=${finishReason}. (Both message.content and message.reasoning were empty — likely truncation or upstream provider error.)`,
      );
      throw new BlueprintGenerationError(
        `AI returned no content for ${format.json_schema.name} (finish_reason=${finishReason})`,
        format.json_schema.name,
      );
    }
    if (
      messagePayload?.reasoning &&
      !messagePayload.content &&
      content === messagePayload.reasoning
    ) {
      this.logger.log(
        `Falling back to message.reasoning for ${format.json_schema.name} — reasoning model emitted JSON in the reasoning channel.`,
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
      // Models occasionally append a trailing markdown fence, citation block,
      // or follow-up commentary after a syntactically complete JSON object.
      // Try to recover by extracting the first complete JSON value before
      // surfacing this as a parse error.
      const recovered = extractFirstJson(content);
      if (recovered !== undefined) {
        this.logger.log(
          `Recovered JSON for ${format.json_schema.name} after stripping trailing non-JSON content`,
        );
        return { kind: 'ok', payload: recovered, assistantMessage };
      }
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
  /**
   * Public so the stage-by-stage controller can compute the cipher plan once
   * (alongside the outline response) and forward it to every per-POI task
   * call client-side. Returns a plain `Record` (not `Map`) so it serialises
   * cleanly over JSON.
   */
  planCipherChains(
    outline: BlueprintOutline,
  ): Record<number, CipherAssignment> {
    const assignments: Record<number, CipherAssignment> = {};
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
      assignments[sources[i].index] = {
        role: 'CIPHER_SOURCE',
        slug,
        value,
        kind: 'WORD',
        label,
      };
      assignments[locks[i].index] = {
        role: 'CIPHER_LOCK',
        slug,
        value,
        kind: 'WORD',
        label,
      };
    }
    const entries = Object.entries(assignments);
    if (entries.length > 0) {
      this.logger.log(
        `Cipher plan: ${pairCount} pair(s) — ${entries
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
  ensureSingleDefaultEnding(
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

/**
 * Heuristic match for "this model doesn't support response_format" errors
 * across providers. Each LLM gateway phrases this differently; we look at
 * the HTTP status (400/422 are the typical rejects) plus the message text.
 *
 * Examples:
 * - OpenAI: 400 "Invalid value for 'response_format': model X does not
 *   support response_format='json_schema'"
 * - OpenRouter (some OSS-routed models): 400 "unsupported response_format"
 *   or 400 "Unrecognized request argument supplied: response_format"
 * - Some smaller models: 422 with "json_schema not supported"
 */
function isUnsupportedResponseFormatError(error: unknown): boolean {
  const err = error as { status?: number; code?: number; message?: string };
  const status = err?.status ?? err?.code ?? 0;
  const msg = (err?.message ?? '').toLowerCase();
  if (status !== 400 && status !== 422) {
    // Some providers don't propagate the status cleanly; still match on the
    // text in case it slipped through as a generic 500 / TypeError.
    if (!msg) return false;
  }
  return (
    msg.includes('response_format') ||
    msg.includes('response format') ||
    msg.includes('json_schema') ||
    msg.includes('json schema') ||
    msg.includes('structured output') ||
    msg.includes('unsupported') ||
    msg.includes('does not support')
  );
}

/**
 * Inlines a "format your response as JSON" directive (with the schema text)
 * into the LAST user message. Used for tiers below `json_schema` so the
 * model sees the shape we expect even when the API isn't enforcing it.
 *
 * For `json_object` we still get wire-level "must be valid JSON" so we keep
 * the directive shorter; for `text` we emphasise "ONLY JSON, nothing else"
 * because the response can otherwise be markdown / prose / partial.
 */
function appendJsonHint(
  messages: ChatCompletionMessageParam[],
  format: StructuredFormat,
  tier: 'json_object' | 'text',
): ChatCompletionMessageParam[] {
  const schemaText = JSON.stringify(format.json_schema.schema, null, 2);
  const directive =
    tier === 'text'
      ? `\n\nRESPONSE FORMAT — STRICT:\nReturn ONLY a single valid JSON object that matches the schema below. Do not include markdown fences, comments, citations, prose before or after the JSON, or any other text. The first character of your response MUST be \`{\` and the last character \`}\`.\n\nJSON SCHEMA (call name: ${format.json_schema.name}):\n${schemaText}`
      : `\n\nRESPONSE FORMAT:\nReturn a single JSON object matching this schema (call name: ${format.json_schema.name}):\n${schemaText}`;

  // Append the directive to the last user message rather than adding a new
  // one, so the existing role-ordering (system → user) doesn't break.
  const lastUserIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return i;
    }
    return -1;
  })();
  if (lastUserIdx === -1) return messages;

  const original = messages[lastUserIdx];
  // The blueprint pipeline only ever emits a single user message with plain
  // string content; if a future caller passes content parts we fall back to
  // leaving the message untouched (the directive simply isn't injected, and
  // the model will likely fail downstream — surfacing a clear error rather
  // than mangling the parts array).
  if (typeof original.content !== 'string') return messages;
  const augmented: ChatCompletionMessageParam = {
    role: 'user',
    content: `${original.content}${directive}`,
  };
  return [
    ...messages.slice(0, lastUserIdx),
    augmented,
    ...messages.slice(lastUserIdx + 1),
  ];
}

/**
 * OpenAI's modern reasoning + flagship models (gpt-5, gpt-4.1, o1, o3,
 * o3-mini, …) reject the legacy `max_tokens` parameter and require
 * `max_completion_tokens` instead. The error body looks like:
 *
 *   400 Unsupported parameter: 'max_tokens' is not supported with this model.
 *   Use 'max_completion_tokens' instead. (code: unsupported_parameter)
 *
 * OpenRouter forwards the same body verbatim when proxying these models.
 * We match on either the param name + the suggestion, or the OpenAI error
 * code, so a worded variant from a future minor model still triggers the
 * automatic switch.
 */
function isMaxCompletionTokensRequiredError(error: unknown): boolean {
  const err = error as {
    status?: number;
    code?: number | string;
    message?: string;
  };
  const status = err?.status ?? (typeof err?.code === 'number' ? err.code : 0);
  const msg = (err?.message ?? '').toLowerCase();
  if (status !== 400 && status !== 422) {
    if (!msg) return false;
  }
  return (
    msg.includes('max_completion_tokens') &&
    (msg.includes('max_tokens') || msg.includes('unsupported_parameter') || msg.includes('use'))
  );
}

/**
 * Inspect an OpenAI / OpenRouter `unsupported_value` / `unsupported_parameter`
 * error and extract the offending parameter name so the caller can drop it
 * from subsequent requests. Reasoning + flagship models (gpt-5, gpt-4.1, o1,
 * o3) return errors like:
 *
 *   400 Unsupported value: 'temperature' does not support 0.4 with this
 *   model. Only the default (1) value is supported.
 *
 * The OpenAI SDK exposes the offending field on `error.param`; the structured
 * field is preferred over the message text but we fall back to a regex on
 * the message for providers/proxies that don't surface it.
 *
 * Returns the parameter name (e.g. `'temperature'`) or `null` if this isn't
 * a "locked-default" error we know how to recover from.
 */
function detectLockedParam(error: unknown): string | null {
  const err = error as {
    status?: number;
    code?: number | string;
    param?: string;
    message?: string;
  };
  const status = err?.status ?? (typeof err?.code === 'number' ? err.code : 0);
  const msg = (err?.message ?? '').toLowerCase();
  if (status !== 400 && status !== 422 && !msg) return null;

  // Only recoverable from "unsupported VALUE" — `unsupported_parameter` would
  // mean the field doesn't exist at all (different fix path; e.g. the
  // `max_tokens → max_completion_tokens` rename has its own detector).
  const isUnsupportedValue =
    msg.includes('unsupported_value') ||
    msg.includes('unsupported value') ||
    msg.includes('does not support');
  if (!isUnsupportedValue) return null;

  // Prefer the structured `param` field when the SDK propagates it.
  const known = ['temperature', 'top_p', 'presence_penalty', 'frequency_penalty', 'logprobs', 'top_logprobs'];
  if (typeof err.param === 'string' && known.includes(err.param)) {
    return err.param;
  }
  for (const name of known) {
    if (msg.includes(`'${name}'`) || msg.includes(`"${name}"`)) return name;
  }
  return null;
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
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

/**
 * Best-effort extraction of the first complete JSON value (object or array) at
 * the start of a string. Used as a recovery path when a model appends trailing
 * commentary, citation blocks, or markdown after a valid JSON payload.
 *
 * Walks the string with a minimal brace/bracket counter that respects strings
 * (incl. escapes) so braces inside content don't confuse the scanner. Returns
 * `undefined` when no complete JSON value is found at the start.
 */
function extractFirstJson(raw: string): unknown | undefined {
  const text = raw.trimStart();
  if (text.length === 0) return undefined;
  const first = text[0];
  if (first !== '{' && first !== '[') return undefined;
  const open = first;
  const close = first === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(0, i + 1);
        try {
          return JSON.parse(candidate) as unknown;
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}
