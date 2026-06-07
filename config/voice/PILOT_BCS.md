# BCS Voice AI Pilot (+387)

Pilot real-time Retell booking on a Bosnian clinic number before wider rollout.

## Prerequisites

- [ ] `npm run dev` and `npm run worker` running
- [ ] Postgres migrated (`calls` table exists)
- [ ] `RETELL_WEBHOOK_SECRET` set in `.env.local` and Retell dashboard
- [ ] `DEFAULT_CLINIC_ID` or per-call `metadata.clinicId` set
- [ ] Settings → AI Calls = ON
- [ ] At least one active doctor in clinic
- [ ] Test patient with phone matching your test SIM

## Retell dashboard

1. Import settings from [`retell-bcs-agent.json`](retell-bcs-agent.json)
2. Replace `YOUR_DOMAIN` with public URL (ngrok / Railway preview)
3. Language: **bs-BA** only
4. Wire Twilio +387 number to agent
5. Enable custom function "speak during execution" for availability checks

## Test script

| Step | Say (Bosnian) | Expected tool | Pass |
|------|---------------|---------------|------|
| 1 | "Zelim termin sutra u deset" | check_availability → book | |
| 2 | "Koji termini su slobodni ovaj tjedan?" | check_availability | |
| 3 | "Zelim otkazati termin" | cancel_appointment | |
| 4 | "Moze li termin pomjeriti na petak u 14?" | reschedule_appointment | |
| 5 | Book already-taken slot | book returns conflict + alternatives | |

## Conflict handling tune

If agent reads conflict poorly, adjust Retell prompt:

```
Ako book_appointment vrati success false i code slot_unavailable,
pročitaj message polje i ponudi prvi predlozeni alternativni termin.
```

## Verify in ClinicOS

- `/voice-ai` → call log shows `booked` / `cancelled` / `rescheduled`
- `/calendar` → appointment appears immediately after call (not after hangup)
- `calls.outcome` populated during call via tool routes

## Rollback

- Turn off Settings → AI Calls
- Or remove custom functions in Retell (agent becomes conversational only)
