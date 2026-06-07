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

## Retell BCS agent (Bosnian / Croatian / Serbian)

Dashboard config reference: [`config/voice/retell-bcs-agent.json`](config/voice/retell-bcs-agent.json)

1. Create agent with language **bs-BA** (single language — best ASR accuracy).
2. Attach 4 custom functions pointing at your deployed tool URLs.
3. Paste Bosnian system prompt from config file.
4. Set call webhook to `POST /api/voice/webhook`.
5. On phone number / agent, set metadata `clinicId`.
6. Connect Twilio +387 (or +385 / +381) number.

Prompt triggers:
- "termin" → check_availability → book_appointment
- "otkazati" → cancel_appointment
- "pomjeriti" → check_availability → reschedule_appointment

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
