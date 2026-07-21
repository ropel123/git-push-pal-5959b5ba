// _shared/aiGateway.ts — passerelle unifiée pour les appels LLM (chat completions).
// Stratégie : Claude 3.5 Sonnet (OpenRouter) par défaut, fallback Gemini (via
// OpenRouter également) sur 429/402/timeout/erreurs réseau. Retry exponential
// backoff (3 tentatives).
//
// Voir docs/architecture/strategie-ia.md.

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIProvider = "claude" | "gemini";

export type AICallOptions = {
  messages: ChatMessage[];
  /** Provider préféré. "claude" par défaut. */
  provider?: AIProvider;
  /** Désactive le fallback automatique vers Gemini. */
  noFallback?: boolean;
  /** Modèle override (sinon : claude-3.5-sonnet ou gemini-2.5-flash). */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Délai max d'un essai en ms (défaut 60s). */
  timeoutMs?: number;
  /** Nombre max de tentatives par provider (défaut 3). */
  maxAttempts?: number;
};

export type AICallResult = {
  content: string;
  provider: AIProvider;
  model: string;
  tokensUsed: number | null;
  latencyMs: number;
  attempts: number;
};

const DEFAULT_CLAUDE_MODEL = "anthropic/claude-3.5-sonnet";
const DEFAULT_GEMINI_MODEL = "google/gemini-2.5-flash";
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callOpenRouter(
  messages: ChatMessage[],
  model: string,
  apiKey: string,
  maxTokens: number | undefined,
  temperature: number | undefined,
  timeoutMs: number
): Promise<{ content: string; tokens: number | null; status: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gaston.app",
        "X-Title": "Gaston",
      },
      body: JSON.stringify({
        model,
        messages,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      const err = new Error(`OpenRouter ${resp.status}: ${errText.slice(0, 300)}`);
      (err as any).status = resp.status;
      throw err;
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const tokens = data?.usage?.total_tokens ?? null;
    return { content, tokens, status: resp.status };
  } finally {
    clearTimeout(t);
  }
}

async function callProvider(
  provider: AIProvider,
  messages: ChatMessage[],
  model: string,
  opts: AICallOptions
): Promise<{ content: string; tokens: number | null; attempts: number; latencyMs: number }> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const start = Date.now();
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Claude comme Gemini passent par OpenRouter — seul le modèle change.
      const key = Deno.env.get("OPENROUTER_API_KEY");
      if (!key) throw new Error("OPENROUTER_API_KEY missing");
      const r = await callOpenRouter(messages, model, key, opts.maxTokens, opts.temperature, timeoutMs);
      return { content: r.content, tokens: r.tokens, attempts: attempt, latencyMs: Date.now() - start };
    } catch (e) {
      lastErr = e;
      const status = (e as any)?.status as number | undefined;
      const retryable = !status || RETRYABLE_STATUS.has(status);
      // B42 : ne logger que le message d'erreur (jamais le corps de requête,
      // qui contient documents / profils utilisateur).
      console.error(
        `[aiGateway] ${provider} attempt ${attempt}/${maxAttempts} failed:`,
        e instanceof Error ? e.message : String(e)
      );
      if (!retryable || attempt === maxAttempts) break;
      await sleep(500 * Math.pow(2, attempt - 1));
    }
  }
  throw lastErr;
}

/** Appel principal — chat completion avec retry + fallback. */
export async function callAI(opts: AICallOptions): Promise<AICallResult> {
  const preferred: AIProvider = opts.provider ?? "claude";
  const defaultModel = preferred === "claude" ? DEFAULT_CLAUDE_MODEL : DEFAULT_GEMINI_MODEL;
  const model = opts.model ?? defaultModel;

  try {
    const r = await callProvider(preferred, opts.messages, model, opts);
    console.log(
      `[aiGateway] ok provider=${preferred} model=${model} tokens=${r.tokens} latency=${r.latencyMs}ms attempts=${r.attempts}`
    );
    return {
      content: r.content,
      provider: preferred,
      model,
      tokensUsed: r.tokens,
      latencyMs: r.latencyMs,
      attempts: r.attempts,
    };
  } catch (primaryErr) {
    if (opts.noFallback) throw primaryErr;
    const fallback: AIProvider = preferred === "claude" ? "gemini" : "claude";
    const fallbackModel = fallback === "claude" ? DEFAULT_CLAUDE_MODEL : DEFAULT_GEMINI_MODEL;
    console.warn(
      `[aiGateway] fallback ${preferred} → ${fallback}:`,
      primaryErr instanceof Error ? primaryErr.message : String(primaryErr)
    );
    const r = await callProvider(fallback, opts.messages, fallbackModel, opts);
    console.log(
      `[aiGateway] fallback ok provider=${fallback} model=${fallbackModel} tokens=${r.tokens} latency=${r.latencyMs}ms`
    );
    return {
      content: r.content,
      provider: fallback,
      model: fallbackModel,
      tokensUsed: r.tokens,
      latencyMs: r.latencyMs,
      attempts: r.attempts,
    };
  }
}
