export const MODEL = "claude-sonnet-4-6";
export const ANTHROPIC_VERSION = "2023-06-01";
export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export function anthropicHeaders(extra = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY no configurado. Añádelo a .env (ver .env.example)."
    );
  }
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    ...extra,
  };
}
