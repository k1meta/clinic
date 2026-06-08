# Voice AI Setup (Retell BCS + ElevenLabs English)

ClinicOS uses **real-time function calling** during live phone calls. Booking, rescheduling, and cancellation happen via tool routes while the caller is still on the line.

## Architecture

```
Caller → Retell (bs-BA) or ElevenLabs (en-US) → POST /api/voice/tools/*
                                              → Postgres appointments
Post-call → POST /api/voice/webhook (Retell) or /api/voice/elevenlabs/webhook
         → BullMQ worker → call logging only
```

## Environment variables

Add to `.env.local`:

```env
# Retell — call events + custom function signature
RETELL_WEBHOOK_SECRET=replace_me

# ElevenLabs — post-call webhook signature
ELEVENLABS_WEBHOOK_SECRET=replace_me

# Optional bearer auth for tool routes (useful for ElevenLabs server tools)
VOICE_TOOLS_API_KEY=replace_me

# Fallback clinic id when metadata has no clinicId
DEFAULT_CLINIC_ID=00000000-0000-0000-0000-000000000001

# Legacy post-call intent booking (disabled by default)
# VOICE_RECONCILE_INTENTS=true
```

If webhook secrets are unset, signature verification is skipped in dev.

## Real-time tool routes

| Route | Purpose |
|-------|---------|
| `POST /api/voice/tools/identify-caller` | Recognize caller by phone (new vs returning) |
| `POST /api/voice/tools/check-availability` | Live slot lookup |
| `POST /api/voice/tools/book` | Create appointment |
| `POST /api/voice/tools/reschedule` | Move next upcoming appt |
| `POST /api/voice/tools/cancel` | Cancel next upcoming appt |

All routes accept:
- **Retell** custom function payload (`name`, `args`, `call`)
- **ElevenLabs** server tool payload (`tool_name`, `parameters`, `conversation_id`)

### Multi-clinic routing

Include `clinicId` in call metadata:

**Retell**
```json
{ "metadata": { "clinicId": "00000000-0000-0000-0000-000000000001" } }
```

**ElevenLabs** — set dynamic variable `clinicId` at call initiation.

### Auth

Verified via (first match wins):
1. `X-Retell-Signature` + `RETELL_WEBHOOK_SECRET`
2. `ElevenLabs-Signature` + `ELEVENLABS_WEBHOOK_SECRET`
3. `Authorization: Bearer <VOICE_TOOLS_API_KEY>`

### Tool response shape

```json
{
  "success": true,
  "message": "Human-readable text for the agent to speak",
  "data": { }
}
```

On conflict (slot taken), `success: false` includes alternative slots in `message`.

## Caller recognition (`identify_caller`)

At the start of each call, the agent should call `POST /api/voice/tools/identify-caller`. ClinicOS looks up the caller's phone number in the patient database and returns:

| `callerType` | Meaning |
|--------------|---------|
| `unknown` | Phone not in database — agent asks for full name |
| `new` | Patient on file but no completed visits |
| `returning` | Known patient with visit history — greet by name |

Response includes `patientName`, `firstName`, optional `upcomingAppointment`, and a Bosnian `message` for the agent to speak.

**Phone resolution order:** tool param `phone` → Retell/ElevenLabs `from_number` metadata → ElevenLabs web-call synthetic id.

**ElevenLabs telephony:** set dynamic variable `from_number` to `{{caller_phone}}` and include it in the `identify_caller` tool body (see [`config/voice/elevenlabs-bcs-agent.json`](config/voice/elevenlabs-bcs-agent.json)).

**Retell:** caller ID is passed automatically via `call.from_number` — no extra config needed.

**Manual test:**

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/voice/tools/identify-caller" `
  -Method POST `
  -Headers @{ Authorization = "Bearer YOUR_VOICE_TOOLS_API_KEY" } `
  -ContentType "application/json" `
  -Body '{"clinicId":"00000000-0000-0000-0000-000000000001","phone":"+38761234567"}'
```

### Booking: new vs returning patients

After `identify_caller`, the agent follows different paths for `book_appointment`:

| Caller type | Before booking | `book_appointment` params |
|-------------|----------------|---------------------------|
| `returning` | Greet by name, confirm identity | `date`, `time`, optional `doctor_id` only |
| `unknown` / `new` | Collect full name + phone | `date`, `time`, **`patient_name`**, **`phone`** (or caller ID) |

Backend behavior:
- **Returning** — matches phone in DB, books under existing patient record (`patientRegistered: false`)
- **New** — creates patient with normalized phone + name, then books (`patientRegistered: true`)
- Never creates `'Nepoznati pacijent'` from voice booking

Error codes for the agent to recover:
- `missing_patient_name` — ask for full name, retry book
- `missing_patient_phone` — ask for phone or confirm caller ID, retry book

```
New caller     → identify (unknown) → collect name + phone → book (registers patient)
Returning      → identify (returning) → book (uses existing record by phone)
```

## Retell BCS agent (Bosnian / Croatian / Serbian)

Dashboard config reference: [`config/voice/retell-bcs-agent.json`](config/voice/retell-bcs-agent.json)

1. Create agent with language **bs-BA** (single language — best ASR accuracy).
2. Attach **5** custom functions pointing at your deployed tool URLs (include `identify_caller`).
3. Paste Bosnian system prompt from config file.
4. Set call webhook to `POST /api/voice/webhook`.
5. On phone number / agent, set metadata `clinicId`.
6. Connect Twilio +387 (or +385 / +381) number.

Prompt triggers:
- Call start → `identify_caller` → greet by name or ask for name
- "termin" → check_availability → book_appointment
- "otkazati" → cancel_appointment
- "pomjeriti" → check_availability → reschedule_appointment

## ElevenLabs BCS agent (Bosnian)

Dashboard config reference: [`config/voice/elevenlabs-bcs-agent.json`](config/voice/elevenlabs-bcs-agent.json)

Same flow as Retell BCS — use Bosnian voice, 5 server tools, dynamic variables `clinicId` + `from_number`.

## ElevenLabs English agent

Dashboard config reference: [`config/voice/elevenlabs-en-agent.json`](config/voice/elevenlabs-en-agent.json)

1. Create ElevenAgents workflow: greeting → intent → tools → confirm.
2. Add 4 server webhook tools (same URLs as Retell).
3. Set dynamic variable `clinicId` per clinic tenant.
4. Post-call webhook → `POST /api/voice/elevenlabs/webhook`.
5. Use `Authorization: Bearer` with `VOICE_TOOLS_API_KEY` on tools if not using signature.

## Runtime

```bash
npm run dev
npm run worker
```

`Settings → AI Features → AI Calls` must be **ON** or tool routes return 403.

## Pilot checklist (BCS +387)

See [`config/voice/PILOT_BCS.md`](config/voice/PILOT_BCS.md).

## Post-call worker behavior

The BullMQ worker **only logs calls** by default. It does not book from transcripts.

Enable legacy transcript intent fallback only with:
```env
VOICE_RECONCILE_INTENTS=true
```

## Call transcripts in the dashboard

Post-call webhooks store transcripts on the `calls` table. View them at **`/voice-ai`** (call list + chat-style viewer) or **`/voice-ai/calls/[id]`** for a single call.

### Transcript pipeline checklist

If test calls show transcripts in ElevenLabs but not in ClinicOS:

1. **`npm run worker`** must be running (jobs queue in Redis until processed).
2. **Settings → AI Calls** must be **ON** (webhook returns early when off).
3. **ElevenLabs post-call webhook** must hit your public URL:
   - `POST https://YOUR_DOMAIN/api/voice/elevenlabs/webhook`
   - Configure in agent settings (`config/voice/elevenlabs-en-agent.json` → `webhooks.post_call`).
4. **`DEFAULT_CLINIC_ID`** must be set if the agent does not pass `clinicId` dynamic variable.
5. **`ELEVENLABS_WEBHOOK_SECRET`** must match the secret in ElevenLabs (or leave unset in dev to skip verification).
6. Use **ngrok** (`npm run tunnel`) for local dev so ElevenLabs can reach your machine.

### Verify in database

```sql
SELECT provider, provider_call_id, left(transcript, 80) AS transcript_preview, summary, created_at
FROM calls
ORDER BY created_at DESC
LIMIT 5;
```

### What gets stored

| Field | Source |
|-------|--------|
| `calls.transcript` | Flat text (`role: message` per line) |
| `calls.summary` | ElevenLabs `analysis.transcript_summary` or Retell `call_analysis` |
| `calls.metadata.transcriptTurns` | Structured turns for chat UI (ElevenLabs) |
| `calls.metadata` | Full webhook payload (debugging) |
