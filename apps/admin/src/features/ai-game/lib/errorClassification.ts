/**
 * Match the message text the backend sends for `AI_CREDITS_INSUFFICIENT`
 * (and a few defensive substring fallbacks in case OpenRouter changes its
 * wording or the error escapes the typed mapping). Shared between the
 * BlueprintInputForm (legacy single-shot) and GenerationStatusBanner
 * (stage-by-stage flow) so the credits card looks identical everywhere.
 */
export function isCreditsError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('ai_credits_insufficient') ||
    lower.includes('kredyt') ||
    lower.includes('requires more credits') ||
    lower.includes('openrouter.ai/settings/credits')
  );
}
