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
import {
  blueprintInputSchema,
  gameBlueprintSchema,
  type GameBlueprint,
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
import { GenerateDescriptionDto } from './dto/generate-description.dto';
import { GenerateHintsDto } from './dto/generate-hints.dto';
import { GeneratePromptDto } from './dto/generate-prompt.dto';
import { GenerateGameBlueprintDto } from './dto/generate-game-blueprint.dto';
import { RefineBlueprintDto } from './dto/refine-blueprint.dto';
import { SetApiKeyDto } from './dto/set-api-key.dto';
import { SetModelDto } from './dto/set-model.dto';
import { TestPromptDto } from './dto/test-prompt.dto';

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
    summary: 'Get current AI configuration (model + masked API key state)',
  })
  @Get('config')
  getConfig() {
    return {
      activeModel: this.aiService.getActiveModel(),
      apiKeyConfigured: this.credentials.isConfigured(),
      apiKeyMasked: this.credentials.getMaskedApiKey(),
      useWebSearch: this.credentials.getUseWebSearch(),
      modelsByPurpose: this.credentials.getModelsByPurpose(),
    };
  }

  @ApiOperation({
    summary:
      'Change the active AI model, web-search toggle, or per-purpose model overrides',
  })
  @Patch('config')
  async setModel(@Body() dto: SetModelDto) {
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

  @ApiOperation({ summary: 'Generate a complete game blueprint with AI' })
  @Post('games/blueprint')
  async generateGameBlueprint(
    @Body() dto: GenerateGameBlueprintDto,
  ): Promise<{ blueprint: GameBlueprint }> {
    this.requireApiKey();
    const input = blueprintInputSchema.parse(dto);
    try {
      const blueprint = await this.blueprintService.generateGameBlueprint(input);
      return { blueprint };
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
      const tasks = await this.blueprintService.generateTasks(input, outline);
      const merged = gameBlueprintSchema.parse({
        ...blueprint,
        tasks: tasks.tasks,
        transitions: tasks.transitions,
      });
      return { blueprint: merged as GameBlueprint };
    } catch (error) {
      this.handleBlueprintError(error);
    }
  }

  private requireApiKey(): void {
    if (!this.credentials.isConfigured()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PRECONDITION_REQUIRED,
          message:
            'OpenRouter API key is not configured. Set it in Settings → AI before generating.',
          code: 'AI_KEY_MISSING',
        },
        HttpStatus.PRECONDITION_REQUIRED,
      );
    }
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
    // Surface the upstream provider error body so the admin sees what went wrong.
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
    this.logger.error(
      `Unexpected blueprint generation error: ${JSON.stringify(providerBody)}`,
    );
    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        message: 'Blueprint generation failed',
        provider: providerBody,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
