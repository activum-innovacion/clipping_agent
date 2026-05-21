export const MODEL = "claude-sonnet-4-6";
export const ANTHROPIC_VERSION = "2023-06-01";
export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const MAX_RETRIES = 5;
const FALLBACK_WAIT_MS = 30_000;

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

function computeWaitMs(response, attempt) {
  // Prefer retry-after (seconds)
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const secs = parseFloat(retryAfter);
    if (!isNaN(secs)) return Math.max(1000, Math.ceil(secs * 1000)) + 1000;
  }

  // Fallback to anthropic-specific reset header (ISO timestamp)
  const reset = response.headers.get("anthropic-ratelimit-input-tokens-reset");
  if (reset) {
    const resetMs = new Date(reset).getTime();
    if (!isNaN(resetMs)) {
      const wait = resetMs - Date.now();
      if (wait > 0) return wait + 1000;
    }
  }

  // Exponential fallback
  return FALLBACK_WAIT_MS * Math.pow(2, attempt);
}

/**
 * POST a /v1/messages con retry automático en 429/529 leyendo los headers
 * de rate limit. Lanza si se agotan los reintentos o si el status no es ok.
 */
export async function anthropicMessage(body) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: anthropicHeaders(),
      body: JSON.stringify(body),
    });

    if (response.ok) return response.json();

    if (response.status === 429 || response.status === 529) {
      const waitMs = computeWaitMs(response, attempt);
      const detail = await response.text().catch(() => "");
      console.log(
        `  ⏳ Rate limit (${response.status}) — esperando ${Math.round(waitMs / 1000)}s antes del retry ${attempt + 1}/${MAX_RETRIES}`
      );
      lastError = new Error(`API ${response.status}: ${detail.slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    // No reintenta otros errores
    const detail = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${detail}`);
  }

  throw lastError || new Error("Anthropic API: max retries exceeded");
}
