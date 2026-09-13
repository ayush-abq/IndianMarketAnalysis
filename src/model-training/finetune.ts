/**
 * Optional later. Do not fine-tune LLM weights by default.
 * Dataset shape if you ever enable it:
 *   { asOf, market_context, expert_analysis, outcome }
 * Evaluate factual consistency and explanation quality — not assumed prediction alpha.
 */
export const FINE_TUNE_DISABLED = true;

export function fineTuneGuard() {
  return {
    enabled: false,
    reason: "RAG + structured context + ML ensemble ship first. Fine-tuning is off until a high-quality local dataset exists.",
  };
}
