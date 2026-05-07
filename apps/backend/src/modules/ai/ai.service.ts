import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { AiCredentialsService, type AiPurpose } from './ai-credentials.service';
import { extractText, parseResponse } from './ai-evaluation.utils';
import type { AiEvaluationResult } from './ai-evaluation.utils';
import { PrismaService } from '../../prisma/prisma.service';

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
  };
  top_provider: { context_length: number; max_completion_tokens: number };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl: string;

  private modelsCache: OpenRouterModel[] | null = null;
  private modelsCacheExpiry = 0;
  private static readonly CACHE_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly credentials: AiCredentialsService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'OPENROUTER_BASE_URL',
      'https://openrouter.ai/api/v1',
    );
    // OpenRouter and OpenAI have completely different model catalogues; bust
    // the cache the moment the admin flips provider so the picker shows the
    // correct list immediately.
    this.credentials.onProviderChange(() => {
      this.modelsCache = null;
      this.modelsCacheExpiry = 0;
    });
  }

  getActiveModel(): string {
    return this.credentials.getModel();
  }

  async setActiveModel(modelId: string): Promise<void> {
    await this.credentials.setModel(modelId);
    this.logger.log(`AI model changed to: ${modelId}`);
  }

  isConfigured(): boolean {
    return this.credentials.isConfigured();
  }

  async listModels(): Promise<OpenRouterModel[]> {
    if (this.modelsCache && Date.now() < this.modelsCacheExpiry) {
      return this.modelsCache;
    }

    const provider = this.credentials.getProvider();

    try {
      const fetched =
        provider === 'openai'
          ? await this.fetchOpenaiModels()
          : await this.fetchOpenRouterModels();

      this.modelsCache = fetched;
      this.modelsCacheExpiry = Date.now() + AiService.CACHE_TTL_MS;
      return fetched;
    } catch (error) {
      this.logger.error(`Failed to fetch ${provider} models`, error);
      return this.modelsCache ?? [];
    }
  }

  private async fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
    const res = await fetch(`${this.baseUrl.replace('/v1', '')}/v1/models`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`OpenRouter API ${res.status}`);
    const json = (await res.json()) as { data: OpenRouterModel[] };
    return json.data ?? [];
  }

  /**
   * Lists OpenAI models from `/v1/models` (OpenAI-compatible) and adapts
   * them into the `OpenRouterModel` shape the model picker consumes.
   * Pricing is empty (`0`) — actual rates depend on the OpenAI plan and
   * aren't surfaced via the listing endpoint, so the UI just labels them
   * "OpenAI · <id>".
   */
  private async fetchOpenaiModels(): Promise<OpenRouterModel[]> {
    const baseUrl = this.credentials.getOpenaiBaseUrl();
    const apiKey = this.credentials.getOpenaiApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
    const json = (await res.json()) as {
      data?: Array<{ id: string; owned_by?: string }>;
    };
    return (json.data ?? []).map((m) => ({
      id: m.id,
      name: m.id,
      description: m.owned_by ? `OpenAI · ${m.owned_by}` : 'OpenAI',
      // The `/v1/models` listing doesn't include context length; surface a
      // safe placeholder. The blueprint pipeline caps `max_tokens` at 16384
      // anyway — the real ceiling is what the model accepts at call time.
      context_length: 128000,
      pricing: { prompt: '0', completion: '0' },
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text'],
      },
      top_provider: {
        context_length: 128000,
        max_completion_tokens: 16384,
      },
    }));
  }

  async evaluatePhoto(
    imageUrl: string,
    prompt: string,
    _threshold: number,
  ): Promise<AiEvaluationResult> {
    try {
      const dataUri = await this.imageToDataUri(imageUrl);
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `You are a game verification assistant. Evaluate whether the submitted photo meets the task requirement.
Respond ONLY with a JSON object (no markdown) in the form:
{"score": <0.0-1.0>, "feedback": "<player-facing message>", "reasoning": "<internal reasoning>"}
The score must reflect how well the photo meets the requirement. 1.0 = fully meets, 0.0 = does not meet.`,
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUri } },
            {
              type: 'text',
              text: `Task requirement: ${prompt}\n\nDoes the provided image meet this requirement? Evaluate carefully.`,
            },
          ],
        },
      ];
      const response = await this.createChatCompletion(messages, 512, 'photoAi');
      return parseResponse(response, this.logger);
    } catch (error) {
      this.logger.error('Photo evaluation failed', error);
      return {
        score: 0,
        feedback: 'Could not evaluate your photo. Please try again.',
        reasoning: `AI evaluation failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      };
    }
  }

  async evaluateText(
    answer: string,
    prompt: string,
    _threshold: number,
    purpose: AiPurpose = 'textAi',
  ): Promise<AiEvaluationResult> {
    try {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `You are a game verification assistant. Evaluate whether a player's answer meets the task requirement.
Respond ONLY with a JSON object (no markdown) in the form:
{"score": <0.0-1.0>, "feedback": "<player-facing message>", "reasoning": "<internal reasoning>"}`,
        },
        {
          role: 'user',
          content: `Task requirement: ${prompt}\n\nPlayer's answer: ${answer}`,
        },
      ];
      const response = await this.createChatCompletion(messages, 512, purpose);
      return parseResponse(response, this.logger);
    } catch (error) {
      this.logger.error('Text evaluation failed', error);
      return {
        score: 0,
        feedback: 'Could not evaluate your answer. Please try again.',
        reasoning: 'AI evaluation temporarily unavailable',
      };
    }
  }

  async evaluateAudio(
    transcription: string,
    prompt: string,
    threshold: number,
  ): Promise<AiEvaluationResult> {
    return this.evaluateText(
      `[Audio transcription] ${transcription}`,
      prompt,
      threshold,
      'audioAi',
    );
  }

  async generateTaskDescription(
    title: string,
    type: string,
    city: string,
    taskId?: string,
  ): Promise<string> {
    try {
      const npcContext = await this.loadNpcContext(taskId ?? null);
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: `You are a city game designer. Write an engaging task description in Polish for the following task.
Task title: "${title}"
Task type: ${type}
City: ${city}${npcContext}

Write 2–3 sentences that describe what the player needs to do. Be specific, immersive, and historically accurate where relevant. Respond with only the description text, no extra formatting.`,
        },
      ];
      const response = await this.createChatCompletion(messages, 512, 'editorHelpers');
      return extractText(response);
    } catch (error) {
      this.logger.error('generateTaskDescription failed', error);
      return '';
    }
  }

  async generateHints(taskDescription: string, count = 3, taskId?: string): Promise<string[]> {
    try {
      const npcContext = await this.loadNpcContext(taskId ?? null);
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: `You are a city game designer. Generate exactly ${count} progressive hints in Polish for the following task. Each hint should reveal slightly more information than the previous one.
Task description: "${taskDescription}"${npcContext}

Respond ONLY with a JSON array of strings, e.g. ["hint 1", "hint 2", "hint 3"]. No markdown or extra text.`,
        },
      ];
      const response = await this.createChatCompletion(messages, 512, 'editorHelpers');
      const text = extractText(response);
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return (parsed as unknown[]).map(String).slice(0, count);
      }
      return [];
    } catch (error) {
      this.logger.error('generateHints failed', error);
      return [];
    }
  }

  async generateAIPrompt(
    taskType: string,
    taskDescription: string,
    taskId?: string,
  ): Promise<string> {
    try {
      const npcContext = await this.loadNpcContext(taskId ?? null);
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: `You are a city game designer. Write a concise AI verification prompt in Polish for the following task. The prompt will be used to instruct an AI evaluator to score a player's submission.
Task type: ${taskType}
Task description: "${taskDescription}"${npcContext}

Respond with only the verification prompt text. It should describe what a correct submission looks like and what the AI should look for. No extra formatting.`,
        },
      ];
      const response = await this.createChatCompletion(messages, 256, 'editorHelpers');
      return extractText(response);
    } catch (error) {
      this.logger.error('generateAIPrompt failed', error);
      return '';
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Loads NPC voice trait context from the task's character, if any.
   * Returns a prompt fragment injected into editor helper calls so
   * descriptions/hints/prompts match the character's voice.
   */
  private async loadNpcContext(taskId: string | null): Promise<string> {
    if (!taskId) return '';

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { npc: true, game: true },
    });

    if (!task?.npc || (task.game as { storyMode?: string }).storyMode === 'NONE') return '';

    return `

KONTEKST POSTACI NPC:
- Imię: ${task.npc.name}
- Archetyp: ${task.npc.archetype}
- Rola w fabule: ${task.npc.roleFunction}
- Głos (voice trait): ${task.npc.voiceTrait}
${task.npc.era ? `- Epoka: ${task.npc.era}` : ''}

WAŻNE: Pisz tak, żeby treść spójnie wpisywała się w głos i misję tej postaci.
Jeśli postać mówi barokowo — narracja brzmi barokowo.
Jeśli ma motywy "księga, klucz, rzeka" — wpleń je w opis.`;
  }

  private async imageToDataUri(imageUrl: string): Promise<string> {
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      throw new Error(
        `Failed to fetch image: HTTP ${res.status} from ${imageUrl}`,
      );
    }

    const contentLength = res.headers.get('content-length');
    if (
      contentLength &&
      parseInt(contentLength, 10) > 20 * 1024 * 1024
    ) {
      throw new Error('Image too large (max 20 MB)');
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const mimeType = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ].includes(contentType)
      ? contentType
      : 'image/jpeg';

    return `data:${mimeType};base64,${base64}`;
  }

  private async createChatCompletion(
    messages: ChatCompletionMessageParam[],
    maxTokens: number,
    purpose: AiPurpose = 'editorHelpers',
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return this.credentials.getClient().chat.completions.create({
      model: this.credentials.getModelFor(purpose),
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    });
  }
}
