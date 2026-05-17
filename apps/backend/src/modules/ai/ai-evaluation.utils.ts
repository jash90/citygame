import { Logger } from '@nestjs/common';
import type OpenAI from 'openai';

export interface AiEvaluationResult {
  score: number;
  feedback: string;
  reasoning: string;
  /**
   * Set by callers when the AI backend itself failed (network/parse/HTTP
   * error) — distinguishes "AI says: 0 points, your answer is wrong" from
   * "AI is broken, we have no verdict". Strategies promote this to a
   * VerificationResult.status of 'ERROR' so the player sees a retryable
   * banner instead of "Incorrect answer".
   */
  unavailable?: boolean;
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
      feedback: 'Nie udało się sprawdzić odpowiedzi — spróbuj ponownie za chwilę.',
      reasoning: 'No text content in response',
      unavailable: true,
    };
  }

  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned) as AiEvaluationResult;
    const rawScore = Number(parsed.score);
    if (!Number.isFinite(rawScore)) {
      logger.warn(`AI returned non-numeric score: ${text}`);
      return {
        score: 0,
        feedback: 'Nie udało się sprawdzić odpowiedzi — spróbuj ponownie za chwilę.',
        reasoning: `Non-numeric score in: ${text}`,
        unavailable: true,
      };
    }
    return {
      score: Math.min(1, Math.max(0, rawScore)),
      feedback: String(parsed.feedback ?? ''),
      reasoning: String(parsed.reasoning ?? ''),
    };
  } catch {
    logger.warn(`Failed to parse AI response: ${text}`);
    return {
      score: 0,
      feedback: 'Nie udało się sprawdzić odpowiedzi — spróbuj ponownie za chwilę.',
      reasoning: text,
      unavailable: true,
    };
  }
}
