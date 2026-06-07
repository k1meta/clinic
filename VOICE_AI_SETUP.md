# Voice AI Setup (Retell + Twilio)

This project now includes a backend path for AI call handling in Bosnian (`bs-BA`):

- `POST /api/voice/webhook` receives Retell events
- events are queued into BullMQ (`voice` queue)
- worker processes intents (`book`, `reschedule`, `cancel`, `availability`)
- actions run against the same appointments/calendar database
- call records are stored in `calls` table and shown in `/voice-ai`

## 1) Environment variables

Add to `.env.local`:

```env
# Retell webhook verification (HMAC SHA-256)
RETELL_WEBHOOK_SECRET=replace_me

# Fallback clinic id if webhook payload metadata has no clinicId
DEFAULT_CLINIC_ID=00000000-0000-0000-0000-000000000001
```

If `RETELL_WEBHOOK_SECRET` is not set, signature verification is skipped in dev.

## 2) Database migration

A new `calls` table is added in:

- `src/db/schema/calls.ts`

Run your normal migration flow (`db:generate` + `db:push` or SQL migration) so the
table and enums exist in Postgres before testing.

## 3) Retell webhook payload requirement

For multi-clinic routing, include `clinicId` in Retell metadata:

```json
{
  "event": "call_transcript",
  "call_id": "call_123",
  "from_number": "+3876xxxxxxx",
  "metadata": { "clinicId": "00000000-0000-0000-0000-000000000001" },
  "transcript": "Zelim termin sutra u 10"
}
```

If `metadata.clinicId` is absent, server falls back to `DEFAULT_CLINIC_ID`.

## 4) Runtime requirements

Keep these running:

```bash
npm run dev
npm run worker
```

## 5) Product owner toggle behavior

`Settings -> AI Features -> AI Calls` controls runtime behavior:

- `ON`: webhook events are queued and processed
- `OFF`: webhook returns success but call AI actions are skipped

## 6) Supported call intents (current)

- booking new appointment
- rescheduling next upcoming appointment
- cancelling next upcoming appointment
- checking near-term availability

These intents are extracted from Bosnian transcript text via the existing LLM adapter.
