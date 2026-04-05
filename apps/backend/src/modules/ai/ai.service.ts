import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface AiEvaluationResult {
  score: number;
  feedback: string;
  reasoning: string;
}

@Injectable()
export class AiService {
  private readonly client: Anthropic;
  private readonly logger = new Logger(AiService.name);
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = this.configService.get<number>('AI_TIMEOUT_MS', 30000);
    this.client = new Anthropic({
      apiKey: this.configService.getOrThrow<string>('ANTHROPIC_API_KEY'),
      timeout: this.timeoutMs,
    });
    this.model = this.configService.get<string>('ANTHROPIC_MODEL', 'claude-sonnet-4-5');
  }

  /**
   * Evaluate a photo submission using Claude Vision.
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
      const imageResponse = await fetch(imageUrl);
      const arrayBuffer = await imageResponse.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      const contentType = imageResponse.headers.get('content-type') ?? 'image/jpeg';
      const mediaType = (
        ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(contentType)
          ? contentType
          : 'image/jpeg'
      ) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      const message = await this.createMessage({
        model: this.model,
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data },
              },
              {
                type: 'text',
                text: userMessage,
              },
            ],
          },
        ],
      });

      return this.parseResponse(message, threshold);
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
   * Evaluate a free-text answer using Claude.
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
      const message = await this.createMessage({
        model: this.model,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      return this.parseResponse(message, threshold);
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
   * Evaluate an audio transcription using Claude.
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
   * Generate a task description for a given title, type and city using Claude.
   */
  async generateTaskDescription(
    title: string,
    type: string,
    city: string,
  ): Promise<string> {
    try {
      const message = await this.createMessage({
        model: this.model,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `You are a city game designer. Write an engaging task description in Polish for the following task.
Task title: "${title}"
Task type: ${type}
City: ${city}

Write 2–3 sentences that describe what the player needs to do. Be specific, immersive, and historically accurate where relevant. Respond with only the description text, no extra formatting.`,
          },
        ],
      });

      const content = message.content[0];
      if (!content || content.type !== 'text') return '';
      return content.text.trim();
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
      const message = await this.createMessage({
        model: this.model,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `You are a city game designer. Generate exactly ${count} progressive hints in Polish for the following task. Each hint should reveal slightly more information than the previous one.
Task description: "${taskDescription}"

Respond ONLY with a JSON array of strings, e.g. ["hint 1", "hint 2", "hint 3"]. No markdown or extra text.`,
          },
        ],
      });

      const content = message.content[0];
      if (!content || content.type !== 'text') return [];
      const parsed = JSON.parse(content.text.trim()) as unknown;
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
      const message = await this.createMessage({
        model: this.model,
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: `You are a city game designer. Write a concise AI verification prompt in Polish for the following task. The prompt will be used to instruct an AI evaluator to score a player's submission.
Task type: ${taskType}
Task description: "${taskDescription}"

Respond with only the verification prompt text. It should describe what a correct submission looks like and what the AI should look for. No extra formatting.`,
          },
        ],
      });

      const content = message.content[0];
      if (!content || content.type !== 'text') return '';
      return content.text.trim();
    } catch (error) {
      this.logger.error('generateAIPrompt failed', error);
      return '';
    }
  }

  /**
   * Call the Anthropic API (non-streaming). Timeout is handled via SDK-level
   * `timeout` option configured in the constructor.
   */
  private async createMessage(
    params: Omit<Parameters<typeof this.client.messages.create>[0], 'stream'>,
  ): Promise<Anthropic.Message> {
    return this.client.messages.create({ ...params, stream: false }) as Promise<Anthropic.Message>;
  }

  private parseResponse(
    message: Anthropic.Message,
    _threshold: number,
  ): AiEvaluationResult {
    const content = message.content[0];
    if (!content || content.type !== 'text') {
      return {
        score: 0,
        feedback: 'Unexpected AI response format',
        reasoning: 'No text content in response',
      };
    }

    try {
      const parsed = JSON.parse(content.text) as AiEvaluationResult;
      return {
        score: Math.min(1, Math.max(0, Number(parsed.score))),
        feedback: String(parsed.feedback ?? ''),
        reasoning: String(parsed.reasoning ?? ''),
      };
    } catch {
      this.logger.warn(`Failed to parse AI response: ${content.text}`);
      return {
        score: 0,
        feedback: 'Could not parse evaluation result',
        reasoning: content.text,
      };
    }
  }
}
