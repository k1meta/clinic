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

/**
 * Provider-agnostic single-shot LLM call. The signature matches the previous
 * implementation so existing call sites keep working unchanged.
 *
 * Backed by Groq (model controlled by `LLM_MODEL`, defaults to
 * `llama-3.3-70b-versatile`). Set `options.json: true` for the intent
 * classifier path so we get clean JSON instead of having to scrape it out
 * of free text. Note: Groq's JSON mode requires the system or user prompt
 * to literally contain the word "JSON" — our intent-classifier prompt
 * already does.
 */
export async function generateResponse(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 300,
  options?: LLMOptions,
): Promise<string> {
  const model = process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile';
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
