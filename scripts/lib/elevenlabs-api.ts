import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const ENV_FILE = join(ROOT, '.env.local');
const STATE_FILE = join(ROOT, 'config', 'voice', '.state.json');

/** IDs of what we created, so setup updates our own objects and never matches by name. */
export type VoiceState = {
  secretId?: string;
  webhookId?: string;
  agentId?: string;
  toolIds?: Record<string, string>;
};

export function readState(): VoiceState {
  return existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, 'utf8')) as VoiceState) : {};
}

export function writeState(state: VoiceState) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

export function isPlaceholder(value: string | undefined): boolean {
  return !value || value.startsWith('replace_me');
}

/** Set one variable in .env.local, keeping every other line as it is. */
export function setEnvValue(name: string, value: string) {
  const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  const next = pattern.test(current)
    ? current.replace(pattern, () => line)
    : current + (current === '' || current.endsWith('\n') ? '' : '\n') + line + '\n';
  writeFileSync(ENV_FILE, next);
  process.env[name] = value;
}

export class ElevenLabsError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function elevenLabs<T>(method: string, path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set in .env.local');
  const base = process.env.ELEVENLABS_API_URL ?? 'https://api.elevenlabs.io';

  const response = await fetch(base + path, {
    method,
    headers: { 'xi-api-key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) throw new ElevenLabsError(response.status, `${method} ${path} → ${response.status}: ${text.slice(0, 600)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/** PATCH an object we created earlier; create it again if it was deleted in ElevenLabs. */
export async function updateOrCreate(
  existingId: string | undefined,
  update: (id: string) => Promise<unknown>,
  create: () => Promise<string>,
): Promise<string> {
  if (existingId) {
    try {
      await update(existingId);
      return existingId;
    } catch (error) {
      if (!(error instanceof ElevenLabsError) || error.status !== 404) throw error;
    }
  }
  return create();
}

export function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}
