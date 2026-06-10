# ClinicOS — AI-Powered Front Office Dashboard

## Project Overview
ClinicOS is a **cloud-hosted SaaS web application** for private medical and dental clinics. It replaces fragmented manual workflows (phone calls, paper schedules, WhatsApp reminders, Google review checks) with a single intelligent dashboard that automates the front office and surfaces actionable data. Sold as a monthly SaaS subscription, white-labelled or agency-branded. Each clinic gets isolated multi-tenant environment.

## Goals
- Reduce appointment no-show rate from ~20% to below 5%
- Automate patient communication across phone, WhatsApp, and SMS
- Single real-time dashboard view from any device
- Surface revenue-tied insights: no-shows recovered, re-engagement bookings, review acquisition
- Zero technical knowledge required from clinic staff

## User Roles
| Role | Access |
|------|--------|
| Clinic Owner / Director | Full access to all modules, analytics, billing, settings |
| Receptionist / Coordinator | Calendar, patient database, call log, alert management |
| Doctor / Practitioner | Read-only view of own daily schedule and patient notes |
| Agency Admin | Backend config, onboarding, troubleshooting |

---

## Tech Stack (Recommended from Spec)

### Frontend
- **Framework:** Next.js (App Router, SSR, file-based routing) + TypeScript
- **Styling:** Tailwind CSS (utility-first)
- **Components:** shadcn/ui (accessible modals, drawers, tables, forms, toasts, badges)
- **State:** Zustand (lightweight global state)
- **Charts:** Recharts (composable SVG charts)
- **Real-time:** Pusher or Soketi (WebSocket push)
- **Forms:** React Hook Form + Zod
- **Dates:** date-fns
- **Icons:** Material Symbols Outlined (used in mockups), Lucide React (recommended in spec)

### Backend
- **Runtime:** Node.js 20 + TypeScript
- **API:** Fastify (schema validation with Zod)
- **Auth:** Clerk (multi-tenancy, MFA, roles, webhooks)
- **Job Queue:** BullMQ + Redis
- **Email:** Resend (React email templates)
- **PDF:** Puppeteer
- **File Storage:** Cloudflare R2
- **Cache:** Upstash Redis

### Database
- **Primary:** PostgreSQL via Supabase (RLS, real-time subscriptions)
- **ORM:** Drizzle ORM (type-safe, fast queries)
- **Multi-tenancy:** Row-level security with `clinic_id` on every table
- **Search:** PostgreSQL full-text search (tsvector)

### AI & Automation
- **LLM Primary:** Anthropic Claude API (claude-sonnet-4-20250514)
- **LLM Fallback:** OpenAI GPT-4o
- **Workflow:** n8n (self-hosted, visual workflow engine)
- **Voice AI:** Vapi.ai (phone number provisioning, STT/TTS, tool calling)
- **WhatsApp:** 360dialog (Business API)
- **SMS:** Twilio
- **Prompt Mgmt:** Langfuse (self-hosted)

### External Integrations
- Google Calendar API (two-way sync)
- Google My Business API (reviews & replies)
- Google Places API (clinic onboarding)
- Twilio (phone numbers for Voice AI)
- Stripe (subscription billing)

### Infrastructure
- **Hosting:** Railway (zero-config deploys, preview environments)
- **CDN/DNS:** Cloudflare
- **Errors:** Sentry
- **Logs:** Better Stack (Logtail)
- **CI/CD:** GitHub Actions
- **Secrets:** Railway environment variables

---

## Current Project Setup
- **Framework:** Next.js 16 + TypeScript + Tailwind CSS v4
- **Directory:** `c:\Users\User\Desktop\startup`
- **Node:** v24.12.0 | npm: 11.7.0
- **Build:** `npm run build` (Turbopack)
- **Dev:** `npm run dev`

## Design System
- **Primary Color:** `#004ac6`
- **Headline Font:** Manrope (700, 800, 900)
- **Body Font:** Inter (400, 500, 600)
- **Icons:** Material Symbols Outlined (Google Fonts CDN)
- **Color Tokens:** Material Design 3 inspired (see `globals.css` for full token list)

## Project Structure
```
src/
  app/
    layout.tsx          # Root layout with Sidebar + TopNav
    page.tsx            # Overview Dashboard (/)
    globals.css         # Tailwind v4 theme tokens + custom classes
    calendar/
      page.tsx          # Appointment Calendar (/calendar)
    patients/
      page.tsx          # Patient Database (/patients)
    voice-ai/
      page.tsx          # Voice AI Control Center (/voice-ai)
  components/
    Sidebar.tsx         # Side navigation with active state
    TopNav.tsx          # Top navigation bar with search
```

## Pages Implemented (Frontend Mockups)
1. **Overview Dashboard** (`/`) — KPIs, weekly occupancy chart, upcoming appointments, smart alerts, Voice AI card
2. **Appointment Calendar** (`/calendar`) — Day view grid, doctor columns, appointment blocks, waiting list sidebar
3. **Patient Database** (`/patients`) — Patient table, search/filters, stats, incomplete files, intelligence highlight
4. **Voice AI Control Center** (`/voice-ai`) — AI status, live transcript, automation toggles, call log table

---

## Core Data Model (10 tables)
All tables include `clinic_id` (UUID, FK to clinics), `created_at`, `updated_at`.

| Table | Purpose |
|-------|---------|
| `clinics` | One row per client clinic (name, slug, timezone, settings JSONB) |
| `users` | Staff accounts (email, role, clerk_user_id) |
| `patients` | Patient records (name, phone, dob, status, opt_out) |
| `appointments` | All bookings (patient, doctor, treatment, status, source) |
| `doctors` | Clinic practitioners (specialty, schedule JSONB) |
| `treatment_types` | Treatment catalogue (name, duration, recurring flag) |
| `messages` | Full communication log (channel, direction, status) |
| `automations` | Automation configs (type, template, channel) |
| `calls` | Voice AI call log (transcript, outcome, summary) |
| `reviews` | Google reviews (rating, reply_draft, posted status) |
| `alerts` | Dashboard alert feed (type, severity, related record) |
| `waiting_list` | Waiting list entries (patient, treatment, preferred window) |

---

## Build Phases
### Phase 1 — MVP (Weeks 1-8) [P0/P1]
- Auth & multi-tenancy (Clerk)
- Overview dashboard
- Appointment calendar (day/week, CRUD, status)
- Patient database (records, search, notes)
- Reminder automation (WhatsApp 48h + SMS fallback + 2h nudge)
- Post-visit follow-up
- Review manager (Google reviews + Claude reply)
- Basic analytics
- Settings module

### Phase 2 — Full Product (Weeks 9-18) [P1/P2]
- Voice AI call handler (Vapi)
- Waiting list automation
- Re-engagement module
- Google Calendar sync
- Analytics ROI module
- CSV import, PDF export, annual check-up nudge

### Phase 3 — Moat Features (Month 5+) [P2]
- Multi-location support
- WhatsApp two-way inbox
- Drag-and-drop calendar
- Custom domain whitelabel
- Doctor mobile view

---

## Non-Functional Requirements
- **Performance:** Dashboard load < 2s, API p95 < 500ms, search < 300ms
- **Reliability:** 99.5% uptime, idempotent reminder jobs, 3x retry with backoff
- **Security:** TLS 1.2+, AES-256 at rest, row-level security, GDPR compliant
- **Scalability:** 500 tenants per deployment, BullMQ burst handling, PgBouncer pooling
- **Accessibility:** Mobile responsive, 44x44px tap targets, multi-language (BS/HR/SR/EN)

---

## Commands
```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
```

## File Naming Conventions
- Components: PascalCase (`Sidebar.tsx`, `TopNav.tsx`)
- Pages: `page.tsx` in route directories
- Styles: `globals.css` with Tailwind v4 `@theme` tokens
