# Voice AI setup

An ElevenLabs agent answers calls the business can't take and books into ClinicOS while the caller is on the line. Twilio is not needed for calls.

```
caller → business number → operator forwards missed calls → +387 landing number
  → SIP → ElevenLabs agent ──► /api/voice/elevenlabs/initiation   clinic data, while ringing
                           ──► /api/voice/tools/*                 booking, during the call
                           ──► /api/voice/elevenlabs/webhook      transcript, after the call
```

## 1. Prerequisites
- Supabase project running, `DATABASE_URL` valid
- `npm run db:migrate-voice` done (creates `voice_numbers`; `/voice-ai` needs it)
- Dashboard → Settings → **AI Calls ON**, at least one active doctor
- ElevenLabs account; API key in `.env.local`

| Variable | Set by | Purpose |
|----------|--------|---------|
| `ELEVENLABS_API_KEY` | you | used only by the setup scripts |
| `VOICE_TOOLS_API_KEY` | setup | bearer key for tools and initiation |
| `ELEVENLABS_WEBHOOK_SECRET` | setup | post-call signature |
| `DEFAULT_CLINIC_ID` | you | clinic for browser tests; ignored in production |
| `VOICE_ID` | you, optional | ElevenLabs voice; choose one that sounds native |
| `VOICE_TTS_MODEL` | optional | default `eleven_v3_conversational` (supports Bosnian) |
| `VOICE_LLM` | optional | default `claude-haiku-5-5` |
| `VOICE_SIP_USERNAME`, `VOICE_SIP_PASSWORD` | you, recommended | login for the landing number |

`RETELL_WEBHOOK_SECRET` is no longer used. Missing secrets reject every request, in development too.

## 2. Create the agent
```bash
npm run dev
npm run voice:tunnel   # separate terminal; exposes only /api/voice, prints the public address
npm run voice:setup -- --url https://YOUR.ngrok.app --clinic <clinic-uuid>
```
Restart `npm run dev` so it reads the new secrets. Run setup again whenever the public URL or `config/voice/agent.ts` changes. `--dry-run` prints what would be sent.

IDs are kept in `config/voice/.state.json` (not in git). Without that file, setup creates new objects instead of touching existing ones.

## 3. Check without a phone line
```bash
npm test
npm run voice:smoke
```
Then follow `config/voice/PILOT_BCS.md`.

## 4. Get a landing number
It must be **Bosnian**: BH Telecom's pages offer forwarding only within BiH.

| Option | Listed cost | Needs |
|--------|-------------|-------|
| [Telnyx](https://support.telnyx.com/en/articles/3506082-bosnia-herzegovina-did-requirements) +387 local | from $35/month | ID or passport, proof of address (≤3 months) in the number's area. Ask about stock and inbound price first |
| SIM gateway | hardware (one 4G model: €270 + VAT) | second BiH SIM, device always online |
| [Zadarma](https://zadarma.com/en/tariffs/numbers/bosnia-and-herzegovina/) +387 33 | about €28 + €28–34/month, 2 lines | company certificate, proof of address |
| [Zadarma 0800](https://zadarma.com/en/tariffs/numbers/bosnia-and-herzegovina/toll-free/) | €25–30/month + €0.45/min | address; forwarding to 0800 unconfirmed |

Prices seen November 2026; confirm before buying. Each clinic needs its own number.

## 5. Connect it
```bash
npm run voice:number -- --e164 +387XXXXXXXX --clinic <clinic-uuid> --provider telnyx
```
At the provider, send calls to `sip:+387XXXXXXXX@sip.rtc.elevenlabs.io:5060;transport=tcp`. The number must match exactly, including `+`. Use TCP or TLS, not UDP.

Zadarma: My PBX → Extensions → forwarding → External server (SIP URI), without `sip:` ([guide](https://zadarma.com/en/support/instructions/elevenlabs/)).

## 6. Forward missed calls
Dashboard → Voice AI shows codes for the clinic's number. BH Telecom mobile:

| When | Code |
|------|------|
| no answer | `**61*NUMBER#` |
| busy | `**67*NUMBER#` |
| off / unreachable | `**62*NUMBER#` |
| check | `*#61#` |
| cancel everything | `##002#` |

Fixed lines use `*61*NUMBER#`. The business pays each forwarded call as a normal call to that number. These codes replace voicemail. Other operators: confirm codes with them.

## Troubleshooting
| Symptom | Look at |
|---------|---------|
| Agent says it can't book | AI Calls off, number not in `voice_numbers`, or database down |
| HTTP 401 on tools | `VOICE_TOOLS_API_KEY` changed: rerun setup, restart the app |
| HTTP 401 on webhook | `ELEVENLABS_WEBHOOK_SECRET`: restart the app |
| No transcript | webhook URL is an old ngrok address: rerun setup |
| Wrong day for "sutra" | agent timezone must be `Europe/Sarajevo` |
| Caller always unknown | caller number lost in forwarding; compare with a direct call |
| Call never reaches the agent | SIP number format, TCP, provider's call log, ElevenLabs SIP messages |

## Privacy
Voice recording is off and ElevenLabs keeps transcripts for 30 days. ClinicOS stores the transcript, summary and numbers, not the raw payload. The agent introduces itself as AI. Get a BiH data-protection review (health data) before paying customers.
