import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { z } from 'zod';
import {
  blueprintInputSchema,
  blueprintTaskSchema,
  gameBlueprintSchema,
  storyBibleSchema,
  type BlueprintInput,
  type BlueprintOutline,
  type BlueprintTask,
  type GameBlueprint,
  type StoryBible,
} from '@citygame/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiCredentialsService } from './ai-credentials.service';
import { AiService } from './ai.service';
import {
  AiGameBlueprintService,
  BlueprintGenerationError,
} from './ai-game-blueprint.service';
import { outlineSchema } from './ai-game-tools';
import type { CipherAssignment } from './ai-game-prompts';
import { GenerateDescriptionDto } from './dto/generate-description.dto';
import { GenerateEndingsDto } from './dto/generate-endings.dto';
import { GenerateHintsDto } from './dto/generate-hints.dto';
import { GenerateOutlineDto } from './dto/generate-outline.dto';
import { GeneratePromptDto } from './dto/generate-prompt.dto';
import { GenerateGameBlueprintDto } from './dto/generate-game-blueprint.dto';
import { GenerateResearchDto } from './dto/generate-research.dto';
import { GenerateStoryBibleDto } from './dto/generate-story-bible.dto';
import { GenerateTaskForPoiDto } from './dto/generate-task-for-poi.dto';
import { GenerateTransitionsDto } from './dto/generate-transitions.dto';
import { RefineBlueprintDto } from './dto/refine-blueprint.dto';
import { SetApiKeyDto } from './dto/set-api-key.dto';
import { SetModelDto } from './dto/set-model.dto';
import { TestPromptDto } from './dto/test-prompt.dto';

/**
 * Inline schema for the cipher assignment forwarded by the orchestrator from
 * the `/outline` response into each `/tasks/single` call. Mirrors backend
 * `CipherAssignment` interface in `ai-game-prompts.ts`.
 */
const cipherAssignmentSchema = z.object({
  role: z.enum(['CIPHER_SOURCE', 'CIPHER_LOCK']),
  slug: z.string(),
  value: z.string(),
  kind: z.enum(['CODE', 'WORD', 'SYMBOL', 'NUMBER']),
  label: z.string(),
});

/**
 * Surface a Zod parse error as a 400. Embeds the flattened issues directly
 * in the message string because NestJS' default BadRequestException
 * serialisation drops extra object fields, and the orchestrator's banner
 * shows the raw message verbatim.
 */
function zodOr400<T>(
  result: z.SafeParseReturnType<unknown, T>,
  what: string,
): T {
  if (result.success) return result.data;
  throw new BadRequestException(
    `${what} is invalid: ${JSON.stringify(result.error.flatten())}`,
  );
}

@ApiTags('AI')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin/ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly blueprintService: AiGameBlueprintService,
    private readonly credentials: AiCredentialsService,
  ) {}

  @ApiOperation({ summary: 'List available OpenRouter models' })
  @Get('models')
  async listModels() {
    const models = await this.aiService.listModels();
    const activeModel = this.aiService.getActiveModel();
    return { models, activeModel };
  }

  @ApiOperation({
    summary: 'Get current AI configuration (provider + model + masked credentials)',
  })
  @Get('config')
  getConfig() {
    return {
      provider: this.credentials.getProvider(),
      openaiApiKeyConfigured: !!this.credentials.getOpenaiApiKey(),
      openaiApiKeyMasked: this.credentials.getOpenaiApiKeyMasked(),
      activeModel: this.aiService.getActiveModel(),
      apiKeyConfigured: this.credentials.isConfigured(),
      apiKeyMasked: this.credentials.getMaskedApiKey(),
      useWebSearch: this.credentials.getUseWebSearch(),
      modelsByPurpose: this.credentials.getModelsByPurpose(),
    };
  }

  @ApiOperation({
    summary:
      'Change the AI provider, active model, web-search toggle, or per-purpose model overrides',
  })
  @Patch('config')
  async setModel(@Body() dto: SetModelDto) {
    // Apply provider FIRST so subsequent web-search / model writes hit the
    // correct provider's storage and `setUseWebSearch` is no-op'd on OpenAI.
    if (dto.provider !== undefined) {
      await this.credentials.setProvider(dto.provider);
    }
    if (dto.model !== undefined) {
      await this.aiService.setActiveModel(dto.model);
    }
    if (dto.useWebSearch !== undefined) {
      await this.credentials.setUseWebSearch(dto.useWebSearch);
    }
    if (dto.modelsByPurpose) {
      // class-transformer instantiates the DTO with every declared field
      // present, so `Object.entries` includes all 5 purposes even when the
      // client sent only one. Skip undefined entries so a PATCH for one
      // purpose doesn't accidentally clear the other four. Empty string still
      // means "clear this override" — only `undefined` means "leave alone".
      for (const [purpose, value] of Object.entries(dto.modelsByPurpose)) {
        if (value === undefined) continue;
        await this.credentials.setModelFor(
          purpose as Parameters<typeof this.credentials.setModelFor>[0],
          value,
        );
      }
    }
    return {
      provider: this.credentials.getProvider(),
      activeModel: this.aiService.getActiveModel(),
      useWebSearch: this.credentials.getUseWebSearch(),
      modelsByPurpose: this.credentials.getModelsByPurpose(),
    };
  }

  @ApiOperation({
    summary: 'Set the OpenRouter API key (overrides the env-supplied default)',
  })
  @Patch('credentials')
  async setApiKey(@Body() dto: SetApiKeyDto) {
    await this.credentials.setApiKey(dto.apiKey);
    return {
      apiKeyConfigured: this.credentials.isConfigured(),
      apiKeyMasked: this.credentials.getMaskedApiKey(),
    };
  }

  @ApiOperation({
    summary: 'Clear the admin-set API key (falls back to env var if any)',
  })
  @Delete('credentials')
  async clearApiKey() {
    await this.credentials.clearApiKey();
    return {
      apiKeyConfigured: this.credentials.isConfigured(),
      apiKeyMasked: this.credentials.getMaskedApiKey(),
    };
  }

  @ApiOperation({
    summary:
      'Set the OpenAI API key (required when provider=openai; ignored for OpenRouter)',
  })
  @Patch('credentials/openai')
  async setOpenaiApiKey(@Body() dto: SetApiKeyDto) {
    await this.credentials.setOpenaiApiKey(dto.apiKey);
    return {
      openaiApiKeyConfigured: !!this.credentials.getOpenaiApiKey(),
      openaiApiKeyMasked: this.credentials.getOpenaiApiKeyMasked(),
    };
  }

  @ApiOperation({ summary: 'Clear the admin-set OpenAI API key' })
  @Delete('credentials/openai')
  async clearOpenaiApiKey() {
    await this.credentials.clearOpenaiApiKey();
    return {
      openaiApiKeyConfigured: !!this.credentials.getOpenaiApiKey(),
      openaiApiKeyMasked: this.credentials.getOpenaiApiKeyMasked(),
    };
  }

  @ApiOperation({ summary: 'Generate a task description using AI' })
  @Post('generate-description')
  async generateDescription(
    @Body() dto: GenerateDescriptionDto,
  ): Promise<{ description: string }> {
    const description = await this.aiService.generateTaskDescription(
      dto.title,
      dto.type,
      dto.city,
    );
    return { description };
  }

  @ApiOperation({ summary: 'Generate progressive hints for a task' })
  @Post('generate-hints')
  async generateHints(
    @Body() dto: GenerateHintsDto,
  ): Promise<{ hints: string[] }> {
    const hints = await this.aiService.generateHints(
      dto.taskDescription,
      dto.count ?? 3,
    );
    return { hints };
  }

  @ApiOperation({ summary: 'Test an AI verification prompt with a sample answer' })
  @Post('test-prompt')
  async testPrompt(
    @Body() dto: TestPromptDto,
  ): Promise<{ score: number; feedback: string; reasoning: string; passed: boolean }> {
    const result = await this.aiService.evaluateText(
      dto.testAnswer,
      dto.prompt,
      dto.threshold,
    );
    return {
      score: result.score,
      feedback: result.feedback,
      reasoning: result.reasoning,
      passed: result.score >= dto.threshold,
    };
  }

  @ApiOperation({ summary: 'Generate an AI verification prompt for a task' })
  @Post('generate-prompt')
  async generatePrompt(
    @Body() dto: GeneratePromptDto,
  ): Promise<{ prompt: string }> {
    const prompt = await this.aiService.generateAIPrompt(
      dto.taskType,
      dto.taskDescription,
    );
    return { prompt };
  }

  // ─── Stage-by-stage blueprint pipeline ──────────────────────────────────
  // The wizard fans out one HTTP call per stage so the UI can show a live
  // checklist (research → bible → outline → tasks×N → transitions/endings)
  // and retry just the stage that broke. Per-POI calls are parallelised by
  // the client with a concurrency cap of 3. See
  // `apps/admin/src/features/ai-game/hooks/useAiBlueprintOrchestrator.ts`.

  @ApiOperation({
    summary:
      'Stage 1: optional `:online` web-search research pack (returns null when web search is off or the call fails)',
  })
  @Post('games/blueprint/research')
  async generateResearch(
    @Body() dto: GenerateResearchDto,
  ): Promise<{ researchPack: string | null }> {
    this.requireApiKey();
    const input = blueprintInputSchema.parse(dto.input);
    try {
      const researchPack = await this.blueprintService.gatherResearchPack(input);
      return { researchPack };
    } catch (error) {
      this.handleBlueprintError(error);
    }
  }

  @ApiOperation({
    summary:
      'Stage 2: generate the StoryBible (narrative skeleton — protagonist, cast, motifs, endings skeleton)',
  })
  @Post('games/blueprint/story-bible')
  async generateStoryBible(
    @Body() dto: GenerateStoryBibleDto,
  ): Promise<{ bible: StoryBible }> {
    this.requireApiKey();
    const input = blueprintInputSchema.parse(dto.input);
    try {
      const bible = await this.blueprintService.generateStoryBible(
        input,
        dto.researchPack ?? null,
      );
      return { bible };
    } catch (error) {
      this.handleBlueprintError(error);
    }
  }

  @ApiOperation({
    summary:
      'Stage 3: generate the outline (POIs + roles + dramatic beats) and the deterministic cipher pre-plan keyed by POI index',
  })
  @Post('games/blueprint/outline')
  async generateOutline(@Body() dto: GenerateOutlineDto): Promise<{
    outline: BlueprintOutline;
    cipherPlan: Record<number, CipherAssignment>;
  }> {
    this.requireApiKey();
    const input = blueprintInputSchema.parse(dto.input);
    const bible = zodOr400(storyBibleSchema.safeParse(dto.bible), 'bible');
    try {
      const outline = await this.blueprintService.generateOutline(
        input,
        bible,
        dto.researchPack ?? null,
      );
      const cipherPlan = this.blueprintService.planCipherChains(outline);
      return { outline, cipherPlan };
    } catch (error) {
      this.handleBlueprintError(error);
    }
  }

  @ApiOperation({
    summary:
      'Stage 4 (×N): generate ONE task for ONE outline POI. The orchestrator fans out N parallel calls (capped at 3 in flight) and forwards the cipher plan from the outline response so SOURCE/LOCK pairs stay consistent.',
  })
  @Post('games/blueprint/tasks/single')
  async generateTaskForPoi(
    @Body() dto: GenerateTaskForPoiDto,
  ): Promise<{ task: BlueprintTask }> {
    this.requireApiKey();
    const input = blueprintInputSchema.parse(dto.input);
    const outline = zodOr400(
      outlineSchema.safeParse(dto.outline),
      'outline',
    ) as BlueprintOutline;
    const bible = zodOr400(storyBibleSchema.safeParse(dto.bible), 'bible');
    const poi = outline.pois.find((p) => p.index === dto.poiIndex);
    if (!poi) {
      throw new BadRequestException(
        `POI with index=${dto.poiIndex} not present in the supplied outline`,
      );
    }
    const cipherAssignment = dto.cipherAssignment
      ? zodOr400(
          cipherAssignmentSchema.safeParse(dto.cipherAssignment),
          'cipherAssignment',
        )
      : undefined;
    try {
      const task = await this.blueprintService.generateTaskForPoi(
        input,
        outline,
        bible,
        poi,
        cipherAssignment,
        dto.researchPack ?? null,
      );
      return { task };
    } catch (error) {
      this.handleBlueprintError(error);
    }
  }

  @ApiOperation({
    summary:
      'Stage 5: generate the transition graph from a finalised task list (depends on tasks; runs in parallel with /endings)',
  })
  @Post('games/blueprint/transitions')
  async generateTransitions(@Body() dto: GenerateTransitionsDto) {
    this.requireApiKey();
    const input = blueprintInputSchema.parse(dto.input);
    const outline = zodOr400(
      outlineSchema.safeParse(dto.outline),
      'outline',
    ) as BlueprintOutline;
    const tasks = zodOr400(
      z.array(blueprintTaskSchema).safeParse(dto.tasks),
      'tasks',
    );
    try {
      const transitions = await this.blueprintService.generateTransitions(
        input,
        outline,
        tasks as BlueprintTask[],
      );
      return { transitions };
    } catch (error) {
      this.handleBlueprintError(error);
    }
  }

  @ApiOperation({
    summary:
      'Stage 6: fill the StoryBible.endingsSkeleton into final endings (depends on tasks; runs in parallel with /transitions). Applies single-default normalisation.',
  })
  @Post('games/blueprint/endings')
  async generateEndings(@Body() dto: GenerateEndingsDto) {
    this.requireApiKey();
    const input = blueprintInputSchema.parse(dto.input);
    const outline = zodOr400(
      outlineSchema.safeParse(dto.outline),
      'outline',
    ) as BlueprintOutline;
    const bible = zodOr400(storyBibleSchema.safeParse(dto.bible), 'bible');
    const tasks = zodOr400(
      z.array(blueprintTaskSchema).safeParse(dto.tasks),
      'tasks',
    );
    try {
      const payload = await this.blueprintService.generateEndings(
        input,
        outline,
        { tasks: tasks as BlueprintTask[], transitions: [] },
        bible,
      );
      const endings = this.blueprintService.ensureSingleDefaultEnding(
        payload.endings,
      );
      return { endings };
    } catch (error) {
      this.handleBlueprintError(error);
    }
  }

  @ApiOperation({ summary: 'Refine one stage of an existing game blueprint' })
  @Post('games/blueprint/refine')
  async refineBlueprint(
    @Body() dto: RefineBlueprintDto,
  ): Promise<{ blueprint: GameBlueprint }> {
    this.requireApiKey();
    const input = blueprintInputSchema.parse(dto.input);
    const parsed = gameBlueprintSchema.safeParse(dto.blueprint);
    if (!parsed.success) {
      throw new BadRequestException(
        `Provided blueprint is invalid: ${JSON.stringify(parsed.error.flatten())}`,
      );
    }
    const blueprint = parsed.data as GameBlueprint;
    try {
      if (dto.stage === 'task') {
        if (typeof dto.taskIndex !== 'number') {
          throw new BadRequestException('taskIndex is required for stage="task"');
        }
        const next = await this.blueprintService.regenerateTask(
          input,
          blueprint,
          dto.taskIndex,
        );
        return { blueprint: next };
      }
      if (dto.stage === 'endings') {
        const next = await this.blueprintService.regenerateEndings(
          input,
          blueprint,
        );
        return { blueprint: next };
      }
      // stage === 'tasks' → full hydration replaces tasks + transitions
      const outline = {
        title: blueprint.title,
        description: blueprint.description,
        city: blueprint.city,
        flowType: blueprint.flowType,
        theme: blueprint.theme,
        prologue: blueprint.prologue,
        pois: blueprint.tasks.map((t) => ({
          index: t.index,
          name: t.title,
          latitude: t.latitude,
          longitude: t.longitude,
          role: 'PUZZLE' as const,
          summary: t.description.slice(0, 240),
        })),
        endingHints: blueprint.endings.map((e) => ({
          slug: e.slug,
          title: e.title,
          flavour: e.description.slice(0, 240),
        })),
      };
      // Tasks regeneration needs the bible for narrative consistency.
      // Legacy blueprints without one synthesize a fresh bible just-in-time;
      // it's persisted onto the merged result so downstream regens stay
      // consistent with the same cast and motifs.
      const bible =
        blueprint.storyBible ??
        (await this.blueprintService.generateStoryBible(input));
      const tasks = await this.blueprintService.generateTasks(
        input,
        outline,
        bible,
      );
      const merged = gameBlueprintSchema.parse({
        ...blueprint,
        storyBible: bible,
        tasks: tasks.tasks,
        transitions: tasks.transitions,
      });
      return { blueprint: merged as GameBlueprint };
    } catch (error) {
      this.handleBlueprintError(error);
    }
  }

  private requireApiKey(): void {
    if (this.credentials.isConfigured()) return;
    const provider = this.credentials.getProvider();
    throw new HttpException(
      {
        statusCode: HttpStatus.PRECONDITION_REQUIRED,
        message:
          provider === 'openai'
            ? 'OpenAI API key is not configured. Set it in Settings → AI before generating.'
            : 'OpenRouter API key is not configured. Set it in Settings → AI before generating.',
        code: 'AI_KEY_MISSING',
      },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }

  private handleBlueprintError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof BlueprintGenerationError) {
      this.logger.warn(`Blueprint generation failed at stage ${error.stage}`);
      // Specialised statuses for actionable, well-known failures so the admin
      // UI can render targeted help (top-up link, key form, etc.).
      if (
        error.details === 'AI_CREDITS_INSUFFICIENT' ||
        error.stage === 'credits'
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            message: error.message,
            stage: error.stage,
            code: 'AI_CREDITS_INSUFFICIENT',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_GATEWAY,
          message: error.message,
          stage: error.stage,
          details: error.details,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
    // Surface the upstream provider error body so the admin sees what went
    // wrong. The global HttpExceptionFilter only forwards `message` and
    // `error` to the wire — extra fields (`provider`) are stripped — so we
    // bake the provider body INTO the message string. The orchestrator's
    // banner shows the message verbatim.
    const err = error as {
      message?: string;
      status?: number;
      error?: unknown;
      response?: { data?: unknown; status?: number };
    };
    const providerBody =
      err.error ??
      err.response?.data ??
      (err.message ? { message: err.message } : { error: 'unknown' });
    const providerSummary = (() => {
      try {
        return JSON.stringify(providerBody);
      } catch {
        return String(providerBody);
      }
    })();
    const status = err.status ?? err.response?.status;
    const summary = status
      ? `HTTP ${status} — ${providerSummary}`
      : providerSummary;
    this.logger.error(
      `Unexpected blueprint generation error: ${summary}`,
    );
    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        message: `Blueprint generation failed: ${summary}`,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
