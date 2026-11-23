# Next steps

Where the voice agent stands and what comes next. Update this file when a step is finished. This repository is public: no secrets, IDs, phone numbers or patient data here.

## Status on 2026-11-23
| Part | State |
|------|-------|
| Code | Voice rebuild is on `main`. Build and 26 unit tests pass; lint has 7 known errors |
| Booking backend | `npm run voice:smoke`: all checks pass against the real database |
| ElevenLabs agent | Set up with 6 tools, initiation webhook and post-call webhook |
| Browser call | One real booking: right time, no duplicate, transcript and summary saved |
| Landing number | None. `voice_numbers` is empty |
| Redis | Host in `.env.local` does not resolve; development runs jobs inline |
| SMS | No `TWILIO_*` variables, so SMS cannot send |

Setup on a machine is recorded in `config/voice/.state.json` (not in git). Without it, `voice:setup` creates duplicates in ElevenLabs. Check the account first and write the existing IDs into that file.

## Start a session
1. `npm run dev` (check that port 3000 is not already this app)
2. `npm run voice:tunnel` in a second terminal; keep it open
3. If the printed address changed: `npm run voice:setup -- --url <address> --clinic <uuid>`

Test bookings land in the real calendar and reminder automations are on. Book under 48 hours ahead, use your own number, and cancel the appointment in `/calendar` afterwards.

## Step 1: Fix the silence (next)
Measured in one 132 s call:

| Turn | Silence before the agent speaks |
|------|------|
| normal | about 1.2 s |
| `identify_caller` + `check_availability` | 6.7 s |
| two turns with failed model attempts | 10.1 s and 13.2 s |

In the two worst turns ElevenLabs reported failed attempts of `claude-haiku-5-5`, 4 to 8 s each. It may be a passing fault. Not yet tried:
- another `VOICE_LLM`
- backup-model and "one moment" filler settings in ElevenLabs (check that they exist)
- skipping `identify_caller` when the caller number is hidden

Measure with `GET /v1/convai/conversations/{id}`: `transcript[].conversation_turn_metrics`. Aim for under 2 s in normal turns and no silence over 5 s.

## Step 2: Finish Gate A
`config/voice/PILOT_BCS.md`. Done: booking a free slot, refused booking without a phone number. Not tested: closed day, 03:00, taken slot, cancelling (must refuse), medical question, emergency (124), "are you a robot", interruption, names with č ć š ž đ.

Voice: `VOICE_ID` is unset. Compare native-sounding voices, and `VOICE_TTS_MODEL=eleven_v4_turbo` with the default `eleven_v3_conversational`. ElevenLabs lists Bosnian for v4 and calls v3 conversational a previous model.

## Step 3: Gate B, internet call
- Needs a +387 number the owner already owns and a free SIP app.
- Set `VOICE_SIP_USERNAME` and `VOICE_SIP_PASSWORD` first.
- ElevenLabs documents `caller_id` and `called_number` in the initiation webhook on SIP. It does not clearly confirm `system__caller_id` on SIP, which the tools depend on. Check it here.

## Step 4: Gate C, number and real call
Buy nothing without the owner's explicit OK. Prices seen November 2026.

| Option | Found | Confirm before paying |
|--------|-------|-----------------------|
| FlyNumber national | $39.95/month + minutes; personal ID and utility bill accepted; forwards to SIP | BH Telecom forwards missed calls to that prefix, and at what price; TCP; caller ID |
| SIM gateway | hardware + second BiH SIM | 4G/VoLTE, SIP over TCP (ElevenLabs: UDP is testing only), SIM terms |
| Number in a clinic's company name | Telnyx from $35/month, Zadarma Sarajevo about €28 + €28–33.60/month | Telnyx's newer page says business use only; Zadarma wants a company certificate |
| Zadarma 0800 | €25–30/month + €0.45/min | forwarding to 0800; activation takes 1–60 working days |

Main unknown: whether the caller's number survives forwarding. Without it the agent still books (it asks for a phone) but cannot move or cancel.

## Step 5: Before a paying clinic
- Permanent hosting for app and worker, new Redis, SMS provider, `TZ=Europe/Sarajevo`
- `scripts/migration-no-overlap.sql`, after checking for existing overlaps (needs the owner's OK)
- `src/jobs/process-reply.ts`: scope every query by `clinic_id`
- `src/worker.ts`: handle `reschedule-selection`; set a timezone on the cron patterns
- Data-protection review (health data) and a form for invoicing
- Branch `Money-grow-engine-shift` conflicts with `main` in 4 files: calendar page, `queries/clinics.ts`, `process-reply.ts`, `ai/conversation.ts`
