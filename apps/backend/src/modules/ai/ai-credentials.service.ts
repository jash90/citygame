import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';

const KEY_API_KEY = 'openrouterApiKey';
const KEY_MODEL = 'openrouterModel';
const KEY_USE_WEB_SEARCH = 'aiUseWebSearch';
const KEY_MODELS_BY_PURPOSE = 'aiModelsByPurpose';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5';

/**
 * Distinct AI use-cases that can each use a different model. Each call site
 * passes its purpose; `getModelFor` returns the per-purpose override or falls
 * back to the global default model. Useful when e.g. cheap blueprint
 * generation should use Sonnet but high-stakes photo verification should use
 * Opus, or vice versa.
 */
export const AI_PURPOSES = [
  'blueprint',
  'photoAi',
  'textAi',
  'audioAi',
  'editorHelpers',
] as const;
export type AiPurpose = (typeof AI_PURPOSES)[number];

/**
 * Owns the OpenRouter credentials (API key + active model) used by every
 * AI-powered service. Persists overrides in the `AppSetting` table so admins
 * can swap keys/models from the panel without redeploying. Falls back to env
 * vars when the table is empty.
 *
 * Plaintext storage is acceptable for self-hosted deployments behind admin
 * auth; encrypt at rest when the surface broadens.
 */
@Injectable()
export class AiCredentialsService implements OnModuleInit {
  private readonly logger = new Logger(AiCredentialsService.name);
  private apiKey: string | null = null;
  private model: string = DEFAULT_MODEL;
  private useWebSearch = false;
  private modelsByPurpose: Partial<Record<AiPurpose, string>> = {};
  private client: OpenAI | null = null;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'OPENROUTER_BASE_URL',
      'https://openrouter.ai/api/v1',
    );
    this.timeoutMs = this.configService.get<number>('AI_TIMEOUT_MS', 60_000);
    this.appUrl = this.configService.get<string>(
      'APP_URL',
      'https://citygame.pl',
    );
  }

  async onModuleInit(): Promise<void> {
    const [dbKey, dbModel, dbWebSearch, dbModelsByPurpose] = await Promise.all([
      this.prisma.appSetting.findUnique({ where: { key: KEY_API_KEY } }),
      this.prisma.appSetting.findUnique({ where: { key: KEY_MODEL } }),
      this.prisma.appSetting.findUnique({ where: { key: KEY_USE_WEB_SEARCH } }),
      this.prisma.appSetting.findUnique({
        where: { key: KEY_MODELS_BY_PURPOSE },
      }),
    ]);

    this.apiKey =
      dbKey?.value ??
      this.configService.get<string>('OPENROUTER_API_KEY') ??
      null;
    this.model =
      dbModel?.value ??
      this.configService.get<string>('OPENROUTER_MODEL', DEFAULT_MODEL);
    this.useWebSearch = dbWebSearch?.value === 'true';
    this.modelsByPurpose = parseModelsByPurpose(dbModelsByPurpose?.value);

    this.refreshClient();

    if (!this.apiKey) {
      this.logger.warn(
        'No OpenRouter API key configured — AI features disabled until set in admin → Settings.',
      );
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Returns the model id assigned to a specific AI purpose, or the global
   * default when no override is set.
   */
  getModelFor(purpose: AiPurpose): string {
    return this.modelsByPurpose[purpose] ?? this.model;
  }

  /** Returns a copy of all per-purpose overrides for the admin UI. */
  getModelsByPurpose(): Partial<Record<AiPurpose, string>> {
    return { ...this.modelsByPurpose };
  }

  /**
   * Sets (or with a falsy value clears) the model override for a given
   * purpose. Persists the full map as JSON in `AppSetting.aiModelsByPurpose`.
   */
  async setModelFor(purpose: AiPurpose, model: string | null | undefined): Promise<void> {
    const trimmed = typeof model === 'string' ? model.trim() : '';
    if (trimmed) {
      this.modelsByPurpose[purpose] = trimmed;
    } else {
      delete this.modelsByPurpose[purpose];
    }
    const value = JSON.stringify(this.modelsByPurpose);
    await this.prisma.appSetting.upsert({
      where: { key: KEY_MODELS_BY_PURPOSE },
      update: { value },
      create: { key: KEY_MODELS_BY_PURPOSE, value },
    });
    this.logger.log(
      `Model override for purpose=${purpose} → ${trimmed || '(cleared)'}`,
    );
  }

  /**
   * Whether the blueprint generator should append `:online` to the model so
   * OpenRouter runs its web-search plugin alongside generation. Persisted in
   * AppSetting so admins toggle it once globally instead of per-game.
   */
  getUseWebSearch(): boolean {
    return this.useWebSearch;
  }

  async setUseWebSearch(value: boolean): Promise<void> {
    this.useWebSearch = value;
    await this.prisma.appSetting.upsert({
      where: { key: KEY_USE_WEB_SEARCH },
      update: { value: value ? 'true' : 'false' },
      create: { key: KEY_USE_WEB_SEARCH, value: value ? 'true' : 'false' },
    });
    this.logger.log(
      `Global AI web-search ${value ? 'enabled' : 'disabled'} by admin`,
    );
  }

  /**
   * Returns a configured OpenAI client. Throws if no API key is set anywhere.
   * Callers should catch this and surface a friendly "configure your key"
   * message to the admin.
   */
  getClient(): OpenAI {
    if (!this.client) {
      throw new Error(
        'OpenRouter API key is not configured. Set it in Settings → AI.',
      );
    }
    return this.client;
  }

  /**
   * Returns the API key with the middle portion masked for display in the UI.
   * Never returns the full key — clients render only this masked form.
   */
  getMaskedApiKey(): string | null {
    if (!this.apiKey) return null;
    if (this.apiKey.length <= 12) return '****';
    return `${this.apiKey.slice(0, 6)}…${this.apiKey.slice(-4)}`;
  }

  async setApiKey(rawKey: string): Promise<void> {
    const trimmed = rawKey.trim();
    if (!trimmed) {
      throw new Error('API key cannot be empty');
    }
    this.apiKey = trimmed;
    await this.prisma.appSetting.upsert({
      where: { key: KEY_API_KEY },
      update: { value: trimmed },
      create: { key: KEY_API_KEY, value: trimmed },
    });
    this.refreshClient();
    this.logger.log('OpenRouter API key updated by admin');
  }

  async clearApiKey(): Promise<void> {
    this.apiKey =
      this.configService.get<string>('OPENROUTER_API_KEY') ?? null;
    await this.prisma.appSetting.delete({ where: { key: KEY_API_KEY } }).catch(() => {
      // ignore — row might not exist
    });
    this.refreshClient();
    this.logger.log('OpenRouter API key cleared (falling back to env var)');
  }

  async setModel(modelId: string): Promise<void> {
    const trimmed = modelId.trim();
    if (!trimmed) throw new Error('Model id cannot be empty');
    this.model = trimmed;
    await this.prisma.appSetting.upsert({
      where: { key: KEY_MODEL },
      update: { value: trimmed },
      create: { key: KEY_MODEL, value: trimmed },
    });
  }

  private refreshClient(): void {
    if (!this.apiKey) {
      this.client = null;
      return;
    }
    this.client = new OpenAI({
      baseURL: this.baseUrl,
      apiKey: this.apiKey,
      timeout: this.timeoutMs,
      defaultHeaders: {
        'HTTP-Referer': this.appUrl,
        'X-Title': 'CityGame',
      },
    });
  }
}

function parseModelsByPurpose(
  raw: string | null | undefined,
): Partial<Record<AiPurpose, string>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<AiPurpose, string>> = {};
    for (const purpose of AI_PURPOSES) {
      const value = parsed[purpose];
      if (typeof value === 'string' && value.trim().length > 0) {
        out[purpose] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}
