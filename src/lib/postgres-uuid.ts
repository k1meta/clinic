import { z } from 'zod';

const POSTGRES_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres `uuid` — Zod 4 `.uuid()` rejects seed/demo ids (non-RFC version nibble). */
export const postgresUuid = () => z.string().regex(POSTGRES_UUID_RE, 'Invalid UUID');

export const optionalPostgresUuid = () =>
  z.preprocess(
    (val) => (val === '' || val == null ? undefined : val),
    postgresUuid().optional(),
  );
