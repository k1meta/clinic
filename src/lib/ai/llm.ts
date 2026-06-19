import Groq from 'groq-sdk';

let _client: Groq | null = null;

function getClient(): Groq {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');
    _client = new Groq({ apiKey });
  }
  return _client;
}

export interface LLMOptions {
  /** When true, request strict JSON output via Groq's response_format. */
  json?: boolean;
}

function primaryModel(): string {
  return process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile';
}

/**
 * Cheaper/faster model used when the primary is rate-limited or erroring.
 * Free Groq tiers hit 429s under load; falling back keeps booking flows alive.
 */
function fallbackModel(): string {
  return process.env.LLM_FALLBACK_MODEL ?? 'llama-3.1-8b-instant';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Rate limits and transient upstream errors are worth retrying / failing over. */
function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 408 || status === 500 || status === 502 || status === 503 || status === 529;
}

async function callModel(
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  options?: LLMOptions,
): Promise<string> {
  const res = await getClient().chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: maxTokens,
    ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
  });
  return res.choices[0]?.message?.content ?? '';
}

/**
 * Provider-agnostic single-shot LLM call. The signature matches the previous
 * implementation so existing call sites keep working unchanged.
 *
 * Backed by Groq (model controlled by `LLM_MODEL`). On a retryable error
 * (429/5xx) it retries with backoff, then fails over to `LLM_FALLBACK_MODEL`
 * before giving up. Set `options.json: true` for the intent-classifier path so
 * we get clean JSON instead of scraping it from free text. Note: Groq's JSON
 * mode requires the prompt to literally contain the word "JSON" — our
 * intent-classifier prompt already does.
 */
export async function generateResponse(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 300,
  options?: LLMOptions,
): Promise<string> {
  const models = [primaryModel(), fallbackModel()].filter((m, i, arr) => arr.indexOf(m) === i);
  let lastErr: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callModel(model, systemPrompt, userMessage, maxTokens, options);
      } catch (err) {
        lastErr = err;
        if (!isRetryable(err)) break;
        await sleep(400 * (attempt + 1));
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('LLM request failed');
}
