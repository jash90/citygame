import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { extractText, parseResponse } from './ai-evaluation.utils';
import type { AiEvaluationResult } from './ai-evaluation.utils';

export const OPENAI_CLIENT = 'OPENAI_CLIENT';

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
  private model: string;
  private readonly baseUrl: string;

  private modelsCache: OpenRouterModel[] | null = null;
  private modelsCacheExpiry = 0;
  private static readonly CACHE_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI,
  ) {
    this.baseUrl = this.configService.get<string>(
      'OPENROUTER_BASE_URL',
      'https://openrouter.ai/api/v1',
    );
    this.model = this.configService.get<string>(
      'OPENROUTER_MODEL',
      'anthropic/claude-sonnet-4-5',
    );
  }

  getActiveModel(): string {
    return this.model;
  }

  setActiveModel(modelId: string): void {
    this.model = modelId;
    this.logger.log(`AI model changed to: ${modelId}`);
  }

  async listModels(): Promise<OpenRouterModel[]> {
    if (this.modelsCache && Date.now() < this.modelsCacheExpiry) {
      return this.modelsCache;
    }

    try {
      const res = await fetch(`${this.baseUrl.replace('/v1', '')}/v1/models`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`OpenRouter API ${res.status}`);
      const json = (await res.json()) as { data: OpenRouterModel[] };

      this.modelsCache = json.data ?? [];
      this.modelsCacheExpiry = Date.now() + AiService.CACHE_TTL_MS;
      return this.modelsCache;
    } catch (error) {
      this.logger.error('Failed to fetch OpenRouter models', error);
      return this.modelsCache ?? [];
    }
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
      const response = await this.createChatCompletion(messages, 512);
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
      const response = await this.createChatCompletion(messages, 512);
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
    );
  }

  async generateTaskDescription(
    title: string,
    type: string,
    city: string,
  ): Promise<string> {
    try {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: `You are a city game designer. Write an engaging task description in Polish for the following task.
Task title: "${title}"
Task type: ${type}
City: ${city}

Write 2–3 sentences that describe what the player needs to do. Be specific, immersive, and historically accurate where relevant. Respond with only the description text, no extra formatting.`,
        },
      ];
      const response = await this.createChatCompletion(messages, 512);
      return extractText(response);
    } catch (error) {
      this.logger.error('generateTaskDescription failed', error);
      return '';
    }
  }

  async generateHints(taskDescription: string, count = 3): Promise<string[]> {
    try {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: `You are a city game designer. Generate exactly ${count} progressive hints in Polish for the following task. Each hint should reveal slightly more information than the previous one.
Task description: "${taskDescription}"

Respond ONLY with a JSON array of strings, e.g. ["hint 1", "hint 2", "hint 3"]. No markdown or extra text.`,
        },
      ];
      const response = await this.createChatCompletion(messages, 512);
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
  ): Promise<string> {
    try {
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: `You are a city game designer. Write a concise AI verification prompt in Polish for the following task. The prompt will be used to instruct an AI evaluator to score a player's submission.
Task type: ${taskType}
Task description: "${taskDescription}"

Respond with only the verification prompt text. It should describe what a correct submission looks like and what the AI should look for. No extra formatting.`,
        },
      ];
      const response = await this.createChatCompletion(messages, 256);
      return extractText(response);
    } catch (error) {
      this.logger.error('generateAIPrompt failed', error);
      return '';
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────

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
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    return this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    });
  }
}
