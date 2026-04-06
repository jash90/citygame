import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface AiEvaluationResult {
  score: number;
  feedback: string;
  reasoning: string;
}

@Injectable()
export class AiService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(AiService.name);
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = this.configService.get<number>('AI_TIMEOUT_MS', 30000);
    this.client = new OpenAI({
      baseURL: this.configService.get<string>(
        'OPENROUTER_BASE_URL',
        'https://openrouter.ai/api/v1',
      ),
      apiKey: this.configService.getOrThrow<string>('OPENROUTER_API_KEY'),
      timeout: this.timeoutMs,
      defaultHeaders: {
        'HTTP-Referer': this.configService.get<string>('APP_URL', 'https://citygame.pl'),
        'X-Title': 'CityGame',
      },
    });
    this.model = this.configService.get<string>(
      'OPENROUTER_MODEL',
      'anthropic/claude-sonnet-4-5',
    );
  }

  /**
   * Evaluate a photo submission using vision model via OpenRouter.
   * @param imageUrl  Public URL of the uploaded image.
   * @param prompt    Description of what the photo should show.
   * @param threshold Minimum score (0–1) to pass (used by callers).
   */
  async evaluatePhoto(
    imageUrl: string,
    prompt: string,
    threshold: number,
  ): Promise<AiEvaluationResult> {
    const systemPrompt = `You are a game verification assistant. Evaluate whether the submitted photo meets the task requirement.
Respond ONLY with a JSON object (no markdown) in the form:
{"score": <0.0-1.0>, "feedback": "<player-facing message>", "reasoning": "<internal reasoning>"}
The score must reflect how well the photo meets the requirement. 1.0 = fully meets, 0.0 = does not meet.`;

    const userMessage = `Task requirement: ${prompt}\n\nDoes the provided image meet this requirement? Evaluate carefully.`;

    try {
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl },
            },
            {
              type: 'text',
              text: userMessage,
            },
          ],
        },
      ];

      const response = await this.createChatCompletion(messages, 512);
      return this.parseResponse(response, threshold);
    } catch (error) {
      this.logger.error('Photo evaluation failed', error);
      return {
        score: 0,
        feedback: 'Could not evaluate your photo. Please try again.',
        reasoning: 'AI evaluation temporarily unavailable',
      };
    }
  }

  /**
   * Evaluate a free-text answer using AI via OpenRouter.
   * @param answer    The player's text answer.
   * @param prompt    The task question / evaluation criteria.
   * @param threshold Minimum score to pass (used by callers).
   */
  async evaluateText(
    answer: string,
    prompt: string,
    threshold: number,
  ): Promise<AiEvaluationResult> {
    const systemPrompt = `You are a game verification assistant. Evaluate whether a player's answer meets the task requirement.
Respond ONLY with a JSON object (no markdown) in the form:
{"score": <0.0-1.0>, "feedback": "<player-facing message>", "reasoning": "<internal reasoning>"}`;

    const userMessage = `Task requirement: ${prompt}\n\nPlayer's answer: ${answer}`;

    try {
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      const response = await this.createChatCompletion(messages, 512);
      return this.parseResponse(response, threshold);
    } catch (error) {
      this.logger.error('Text evaluation failed', error);
      return {
        score: 0,
        feedback: 'Could not evaluate your answer. Please try again.',
        reasoning: 'AI evaluation temporarily unavailable',
      };
    }
  }

  /**
   * Evaluate an audio transcription using AI via OpenRouter.
   * @param transcription The transcribed text of the audio recording.
   * @param prompt        Task evaluation criteria.
   * @param threshold     Minimum score to pass (used by callers).
   */
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

  /**
   * Generate a task description for a given title, type and city.
   */
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
      return this.extractText(response);
    } catch (error) {
      this.logger.error('generateTaskDescription failed', error);
      return '';
    }
  }

  /**
   * Generate an array of hint strings for a task description.
   */
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
      const text = this.extractText(response);
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

  /**
   * Generate an AI verification prompt for a task.
   */
  async generateAIPrompt(taskType: string, taskDescription: string): Promise<string> {
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
      return this.extractText(response);
    } catch (error) {
      this.logger.error('generateAIPrompt failed', error);
      return '';
    }
  }

  /**
   * Call OpenRouter chat completions API (non-streaming).
   */
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

  /**
   * Extract text content from the first choice in a chat completion response.
   */
  private extractText(response: OpenAI.Chat.Completions.ChatCompletion): string {
    const content = response.choices?.[0]?.message?.content;
    return content?.trim() ?? '';
  }

  private parseResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
    _threshold: number,
  ): AiEvaluationResult {
    const text = this.extractText(response);
    if (!text) {
      return {
        score: 0,
        feedback: 'Unexpected AI response format',
        reasoning: 'No text content in response',
      };
    }

    try {
      const parsed = JSON.parse(text) as AiEvaluationResult;
      return {
        score: Math.min(1, Math.max(0, Number(parsed.score))),
        feedback: String(parsed.feedback ?? ''),
        reasoning: String(parsed.reasoning ?? ''),
      };
    } catch {
      this.logger.warn(`Failed to parse AI response: ${text}`);
      return {
        score: 0,
        feedback: 'Could not parse evaluation result',
        reasoning: text,
      };
    }
  }
}
