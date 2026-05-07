import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';

const KEY_OPENROUTER_API_KEY = 'openrouterApiKey';
const KEY_MODEL = 'openrouterModel';
const KEY_USE_WEB_SEARCH = 'aiUseWebSearch';
const KEY_MODELS_BY_PURPOSE = 'aiModelsByPurpose';
const KEY_PROVIDER = 'aiProvider';
const KEY_OPENAI_API_KEY = 'aiOpenaiApiKey';

const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4-5';
const DEFAULT_OPENAI_MODEL = 'gpt-5';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

/**
 * Provider that owns the LLM endpoint.
 *
 * - `openrouter`: cloud aggregator, supports OpenRouter-specific extensions
 *   like the `:online` web-search plugin.
 * - `openai`: direct OpenAI API at api.openai.com — first-class structured
 *   outputs (`response_format: json_schema` enforced wire-side), no
 *   web-search variant.
 *
 * Both speak the OpenAI chat completions schema, so the SDK client is
 * identical — only the baseURL + key differ.
 */
export const AI_PROVIDERS = ['openrouter', 'openai'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/**
 * Distinct AI use-cases that can each use a different model. Each call site
 * passes its purpose; `getModelFor` returns the per-purpose override or falls
 * back to the global default model. Useful when e.g. cheap blueprint
 * generation should use one model but high-stakes photo verification uses
 * another.
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
 * Owns the OpenRouter and OpenAI credentials (API keys + active model) used
 * by every AI-powered service. Persists overrides in the `AppSetting` table
 * so admins can swap keys/models from the panel without redeploying. Falls
 * back to env vars when the table is empty.
 *
 * Plaintext storage is acceptable for self-hosted deployments behind admin
 * auth; encrypt at rest when the surface broadens.
 */
@Injectable()
export class AiCredentialsService implements OnModuleInit {
  private readonly logger = new Logger(AiCredentialsService.name);
  private provider: AiProvider = 'openrouter';
  private openrouterApiKey: string | null = null;
  private openaiApiKey: string | null = null;
  private model: string = DEFAULT_OPENROUTER_MODEL;
  private useWebSearch = false;
  private modelsByPurpose: Partial<Record<AiPurpose, string>> = {};
  private client: OpenAI | null = null;
  private readonly openrouterBaseUrl: string;
  private readonly openaiBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.openrouterBaseUrl = this.configService.get<string>(
      'OPENROUTER_BASE_URL',
      'https://openrouter.ai/api/v1',
    );
    // Allow Azure / proxy deployments to override the OpenAI base URL via
    // env without touching the DB. Default points at api.openai.com/v1.
    this.openaiBaseUrl = this.configService.get<string>(
      'OPENAI_BASE_URL',
      DEFAULT_OPENAI_BASE_URL,
    );
    // Long default — the blueprint pipeline runs 7-8 chained Anthropic calls
    // and individual `:online` research calls on OpenRouter routinely exceed
    // 60 s. Keep the SDK's per-call abort generous so the orchestrator gets
    // to retry-on-content rather than being killed mid-stage by the SDK.
    this.timeoutMs = this.configService.get<number>('AI_TIMEOUT_MS', 300_000);
    this.appUrl = this.configService.get<string>(
      'APP_URL',
      'https://citygame.pl',
    );
  }

  async onModuleInit(): Promise<void> {
    const [
      dbOpenrouterKey,
      dbModel,
      dbWebSearch,
      dbModelsByPurpose,
      dbProvider,
      dbOpenaiKey,
    ] = await Promise.all([
      this.prisma.appSetting.findUnique({
        where: { key: KEY_OPENROUTER_API_KEY },
      }),
      this.prisma.appSetting.findUnique({ where: { key: KEY_MODEL } }),
      this.prisma.appSetting.findUnique({ where: { key: KEY_USE_WEB_SEARCH } }),
      this.prisma.appSetting.findUnique({
        where: { key: KEY_MODELS_BY_PURPOSE },
      }),
      this.prisma.appSetting.findUnique({ where: { key: KEY_PROVIDER } }),
      this.prisma.appSetting.findUnique({
        where: { key: KEY_OPENAI_API_KEY },
      }),
    ]);

    const persistedProvider = dbProvider?.value;
    const envProvider = this.configService.get<string>('AI_PROVIDER');
    const candidate = persistedProvider ?? envProvider ?? 'openrouter';
    this.provider = (AI_PROVIDERS as readonly string[]).includes(candidate)
      ? (candidate as AiProvider)
      : 'openrouter';

    this.openrouterApiKey =
      dbOpenrouterKey?.value ??
      this.configService.get<string>('OPENROUTER_API_KEY') ??
      null;
    this.openaiApiKey =
      dbOpenaiKey?.value ??
      this.configService.get<string>('OPENAI_API_KEY') ??
      null;
    this.model =
      dbModel?.value ??
      this.configService.get<string>(
        'OPENROUTER_MODEL',
        this.provider === 'openai'
          ? DEFAULT_OPENAI_MODEL
          : DEFAULT_OPENROUTER_MODEL,
      );
    // OpenAI doesn't have an `:online` web-search variant — keep the toggle
    // OFF unconditionally for that provider.
    this.useWebSearch =
      this.provider === 'openai' ? false : dbWebSearch?.value === 'true';
    this.modelsByPurpose = parseModelsByPurpose(dbModelsByPurpose?.value);

    this.refreshClient();

    if (!this.isConfigured()) {
      this.logger.warn(
        `AI provider ${this.provider} is not configured — set the API key in admin → Settings before generating.`,
      );
    } else {
      this.logger.log(
        `AI provider: ${this.provider} (model=${this.model}, useWebSearch=${this.useWebSearch}).`,
      );
    }
  }

  getProvider(): AiProvider {
    return this.provider;
  }

  /**
   * Switching provider implicitly toggles which fields are required:
   *   - openrouter: needs an API key; useWebSearch may be re-enabled.
   *   - openai: needs an API key; useWebSearch forced off (no `:online`).
   * The model id is preserved across switches — admin will see whatever they
   * picked last; if it's not valid for the new provider, the next call surfaces
   * a 4xx and the model picker can fix it.
   */
  async setProvider(provider: AiProvider): Promise<void> {
    this.provider = provider;
    if (provider === 'openai') {
      this.useWebSearch = false;
      await this.prisma.appSetting.upsert({
        where: { key: KEY_USE_WEB_SEARCH },
        update: { value: 'false' },
        create: { key: KEY_USE_WEB_SEARCH, value: 'false' },
      });
    }
    await this.prisma.appSetting.upsert({
      where: { key: KEY_PROVIDER },
      update: { value: provider },
      create: { key: KEY_PROVIDER, value: provider },
    });
    this.refreshClient();
    this.notifyProviderChange();
    this.logger.log(`AI provider switched to ${provider}`);
  }

  /**
   * Subscription hook used by services that cache provider-specific data
   * (e.g. `AiService.listModels` caches the response — that cache is
   * meaningless after the URL or key changes for the same provider, not
   * just on a hard provider swap).
   */
  private providerChangeListeners: Array<(p: AiProvider) => void> = [];
  onProviderChange(listener: (p: AiProvider) => void): () => void {
    this.providerChangeListeners.push(listener);
    return () => {
      this.providerChangeListeners = this.providerChangeListeners.filter(
        (l) => l !== listener,
      );
    };
  }
  private notifyProviderChange(): void {
    this.providerChangeListeners.forEach((fn) => fn(this.provider));
  }

  /**
   * "Configured" means we can issue a chat completion right now — both
   * providers require their respective API key. Server reachability is
   * checked at call time.
   */
  isConfigured(): boolean {
    if (this.provider === 'openai') return !!this.openaiApiKey;
    return !!this.openrouterApiKey;
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
  async setModelFor(
    purpose: AiPurpose,
    model: string | null | undefined,
  ): Promise<void> {
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
   * Always false on OpenAI — no `:online` web-search plugin. The setter is
   * a no-op when provider is OpenAI; the UI hides the toggle but defensive
   * enforcement here keeps any stale call safe.
   */
  getUseWebSearch(): boolean {
    if (this.provider === 'openai') return false;
    return this.useWebSearch;
  }

  async setUseWebSearch(value: boolean): Promise<void> {
    if (this.provider === 'openai') {
      this.logger.warn(
        'Ignoring setUseWebSearch — provider is OpenAI (no `:online` variant).',
      );
      return;
    }
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
   * Returns a configured OpenAI-compatible client. Throws when the active
   * provider isn't configured (no API key); callers surface this as a
   * friendly "configure your key" admin message.
   */
  getClient(): OpenAI {
    if (!this.client) {
      throw new Error(
        this.provider === 'openai'
          ? 'OpenAI API key is not configured. Set it in Settings → AI.'
          : 'OpenRouter API key is not configured. Set it in Settings → AI.',
      );
    }
    return this.client;
  }

  // ─── OpenRouter key (the original `apiKey` API) ────────────────────────

  /**
   * Returns the OpenRouter API key with the middle portion masked. Never
   * returns the full key — clients render only this masked form.
   */
  getMaskedApiKey(): string | null {
    return maskKey(this.openrouterApiKey);
  }

  async setApiKey(rawKey: string): Promise<void> {
    const trimmed = rawKey.trim();
    if (!trimmed) throw new Error('API key cannot be empty');
    this.openrouterApiKey = trimmed;
    await this.prisma.appSetting.upsert({
      where: { key: KEY_OPENROUTER_API_KEY },
      update: { value: trimmed },
      create: { key: KEY_OPENROUTER_API_KEY, value: trimmed },
    });
    if (this.provider === 'openrouter') this.refreshClient();
    this.logger.log('OpenRouter API key updated by admin');
  }

  async clearApiKey(): Promise<void> {
    this.openrouterApiKey =
      this.configService.get<string>('OPENROUTER_API_KEY') ?? null;
    await this.prisma.appSetting
      .delete({ where: { key: KEY_OPENROUTER_API_KEY } })
      .catch(() => {
        // ignore — row might not exist
      });
    if (this.provider === 'openrouter') this.refreshClient();
    this.logger.log('OpenRouter API key cleared (falling back to env var)');
  }

  // ─── OpenAI key ────────────────────────────────────────────────────────

  getOpenaiApiKey(): string | null {
    return this.openaiApiKey;
  }

  getOpenaiApiKeyMasked(): string | null {
    return maskKey(this.openaiApiKey);
  }

  async setOpenaiApiKey(rawKey: string): Promise<void> {
    const trimmed = rawKey.trim();
    if (!trimmed) throw new Error('OpenAI API key cannot be empty');
    this.openaiApiKey = trimmed;
    await this.prisma.appSetting.upsert({
      where: { key: KEY_OPENAI_API_KEY },
      update: { value: trimmed },
      create: { key: KEY_OPENAI_API_KEY, value: trimmed },
    });
    if (this.provider === 'openai') {
      this.refreshClient();
      // Switching the key may unlock previously-401 model listings in
      // `AiService.listModels`. Flush downstream caches.
      this.notifyProviderChange();
    }
    this.logger.log('OpenAI API key updated by admin');
  }

  async clearOpenaiApiKey(): Promise<void> {
    this.openaiApiKey =
      this.configService.get<string>('OPENAI_API_KEY') ?? null;
    await this.prisma.appSetting
      .delete({ where: { key: KEY_OPENAI_API_KEY } })
      .catch(() => {
        // ignore — row might not exist
      });
    if (this.provider === 'openai') {
      this.refreshClient();
      this.notifyProviderChange();
    }
    this.logger.log(
      'OpenAI API key cleared (falling back to OPENAI_API_KEY env var if set)',
    );
  }

  /** Base URL the OpenAI client points at. Surfaced for the model lister. */
  getOpenaiBaseUrl(): string {
    return this.openaiBaseUrl;
  }

  // ─── Active model ──────────────────────────────────────────────────────

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

  // ─── Client construction ───────────────────────────────────────────────

  private refreshClient(): void {
    if (this.provider === 'openai') {
      if (!this.openaiApiKey) {
        this.client = null;
        return;
      }
      this.client = new OpenAI({
        baseURL: this.openaiBaseUrl,
        apiKey: this.openaiApiKey,
        timeout: this.timeoutMs,
      });
      return;
    }

    // openrouter
    if (!this.openrouterApiKey) {
      this.client = null;
      return;
    }
    this.client = new OpenAI({
      baseURL: this.openrouterBaseUrl,
      apiKey: this.openrouterApiKey,
      timeout: this.timeoutMs,
      defaultHeaders: {
        'HTTP-Referer': this.appUrl,
        'X-Title': 'CityGame',
      },
    });
  }
}

function maskKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 12) return '****';
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
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
