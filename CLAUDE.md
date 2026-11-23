# ClinicOS

Front-office dashboard for private clinics and other appointment businesses in BiH. Sold as a monthly, white-label, multi-tenant SaaS. Staff need no technical knowledge.

**Current status and what to do next: `NEXT_STEPS.md`.** Read it first; update it when a step is done.

## Goals
- Reduce no-shows from ~20% to below 5%
- An AI answers the phone when the business can't, and books the appointment
- Automate reminders and replies over WhatsApp, SMS and email
- Show owners the revenue this recovers

## Rules for working here
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (see `AGENTS.md`). This is Next.js 16: middleware is `src/proxy.ts`.
- **Every query is scoped by `clinic_id`.** Pages and actions get it from `getClinicId()` / `requireAdmin()` in `src/db/queries/auth.ts`.
- **Never use the server's timezone for appointments.** No `getHours()`, no `new Date('YYYY-MM-DDTHH:MM')`. Use `src/lib/timezone.ts` with `getClinicSettings(clinicId).timezone`.
- **Phone numbers:** parse with `toE164()` from `src/lib/phone.ts`; match stored ones with `phoneDigitVariants()`.
- Do not log names, phone numbers, transcripts or raw provider payloads. Use `describeError()` for database errors.
- Text spoken or shown to patients is Bosnian (ijekavica), formal "Vi".
- Database migrations, purchases and messages to real people need the owner's explicit OK.

## Stack (what is actually used)
| Area | Choice |
|------|--------|
| App | Next.js 16 App Router, React 19, TypeScript, server actions, route handlers |
| UI | Tailwind CSS v4 tokens in `src/app/globals.css`, Material Symbols, Manrope + Inter, light/dark |
| Auth | Supabase Auth; roles `admin` and `staff` in `users` |
| Database | Supabase Postgres, Drizzle ORM (`src/db/schema`) |
| Jobs | BullMQ + Upstash Redis, worker in `src/worker.ts`; inline fallback in development |
| Text AI | Groq (`src/lib/ai`) |
| Voice AI | ElevenLabs Agents over SIP |
| Messaging | Meta WhatsApp/Instagram/Messenger Cloud API, Twilio SMS, Resend email |

Not used despite older plans: Clerk, Fastify, n8n, Vapi, Retell, 360dialog, shadcn/ui, Zustand, Stripe.

## Layout
```
config/voice/agent.ts     Bosnian phone agent: prompt and tools, as code
scripts/                  migrations, voice setup, smoke test
src/app/(dashboard)/      pages; src/app/(auth)/ sign-in
src/app/actions/          server actions
src/app/api/              webhooks, cron, voice tools (public paths are listed in src/proxy.ts)
src/db/schema, queries/   Drizzle tables and queries
src/jobs/                 reminder scans, message sending, call logging
src/lib/voice/            phone booking logic
src/lib/availability.ts   slots and booking rules, shared by all channels
tests/                    node:test, no database needed
```

## Voice AI
```
caller → business number → (no answer / busy / off) operator forwards
  → +387 landing number → SIP → ElevenLabs agent → /api/voice/* → Postgres
```
- Setup: `VOICE_AI_SETUP.md`. Test plan: `config/voice/PILOT_BCS.md`.
- The **called number** picks the clinic (`voice_numbers`). `DEFAULT_CLINIC_ID` works outside production only.
- Identity comes from `caller_number`, `called_number` and `conversation_id`, which ElevenLabs fills from the phone network. Model-written fields are never proof of identity.
- Only caller ID may reveal, move or cancel an appointment. A spoken number can only register a patient. Otherwise use `take_message`.
- Caller ID can be spoofed, so never expose medical data by phone.
- Auth fails closed: bearer key on tools and initiation, HMAC on the post-call webhook.
- Tools answer business failures with HTTP 200 and `success: false`; the agent reads `message`.
- No live transfer: ringing the business would forward back to the AI.
- Landing numbers must be Bosnian. BH Telecom does not offer forwarding abroad.

## Commands
```bash
npm run dev              # app
npm run worker           # queue worker and reminder schedule
npm run build            # production build
npm run lint
npm test                 # unit tests
npm run voice:tunnel     # public address for /api/voice only (ngrok)
npm run voice:setup      # push config/voice/agent.ts to ElevenLabs
npm run voice:number     # connect a number to a clinic
npm run voice:smoke      # end-to-end tool check against a running app
npm run db:migrate-voice # voice_numbers table
npm run tunnel           # ngrok + registers the WhatsApp webhook with Meta
```

## Known gaps
- Opening hours are per weekday (`settings.weekHours`, see `src/lib/work-week.ts`); no per-doctor hours or holidays yet.
- `drizzle/` contains only the first migration; later changes are in `scripts/`.
- `scripts/migration-no-overlap.sql` is manual. Voice bookings lock per doctor anyway; other channels rely on it.
- Analytics date ranges still use server time; set `TZ=Europe/Sarajevo` on the host.
- ESLint reports 7 older errors (`useInlineQueueFallback` naming, two effects).
- Branch `Money-grow-engine-shift` (waiting list, booking widget, referrals) is not merged.
