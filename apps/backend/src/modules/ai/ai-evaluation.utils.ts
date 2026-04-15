import { Logger } from '@nestjs/common';
import type OpenAI from 'openai';

export interface AiEvaluationResult {
  score: number;
  feedback: string;
  reasoning: string;
}

export function extractText(response: OpenAI.Chat.Completions.ChatCompletion): string {
  const content = response.choices?.[0]?.message?.content;
  return content?.trim() ?? '';
}

export function parseResponse(
  response: OpenAI.Chat.Completions.ChatCompletion,
  logger: Logger,
): AiEvaluationResult {
  const text = extractText(response);
  if (!text) {
    return {
      score: 0,
      feedback: 'Unexpected AI response format',
      reasoning: 'No text content in response',
    };
  }

  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned) as AiEvaluationResult;
    return {
      score: Math.min(1, Math.max(0, Number(parsed.score))),
      feedback: String(parsed.feedback ?? ''),
      reasoning: String(parsed.reasoning ?? ''),
    };
  } catch {
    logger.warn(`Failed to parse AI response: ${text}`);
    return {
      score: 0,
      feedback: 'Could not parse evaluation result',
      reasoning: text,
    };
  }
}
