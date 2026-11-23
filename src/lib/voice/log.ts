/**
 * Database errors carry the query parameters (names, phone numbers) in their message.
 * Log only the innermost cause.
 */
export function describeError(error: unknown): string {
  let current = error;
  while (current instanceof Error && current.cause instanceof Error) current = current.cause;
  if (!(current instanceof Error)) return 'unknown error';
  if (/^Failed query:/.test(current.message)) return 'database query failed';
  const code = (current as { code?: unknown }).code;
  return typeof code === 'string' ? `${code}: ${current.message}` : current.message;
}

export function logVoiceError(context: string, error: unknown): void {
  console.error(`[voice] ${context}:`, describeError(error));
}
