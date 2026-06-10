# WhatsApp AI Messaging — Setup Walkthrough

End-to-end checklist to get the AI scheduling/reschedule/cancel flow and the 48 h
interactive reminder working against a real phone. Phase 2 (Instagram, Messenger)
is at the bottom.

## Prerequisites

You should already have (these are in [.env.local](.env.local)):

- A Meta App (`META_APP_ID`, `META_APP_SECRET`)
- A WhatsApp Business Account (`WHATSAPP_BUSINESS_ACCOUNT_ID`)
- A WhatsApp test phone number (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`)
- Webhook verify token (`WHATSAPP_VERIFY_TOKEN`)

What you still need:

- `GROQ_API_KEY` — get one from <https://console.groq.com/keys>. Free tier,
  no card required, 30 req/min on Llama 3.3 70B which is plenty for a single
  clinic's traffic. Without this every AI reply throws inside
  [src/lib/ai/llm.ts](src/lib/ai/llm.ts) and patients get the fallback
  "tehnicke poteskoce" message.
- `LLM_MODEL` — defaults to `llama-3.3-70b-versatile`. Switch to
  `llama-3.1-8b-instant` for faster/cheaper but lower-quality replies.

  > Why Groq and not Gemini/OpenAI? Gemini's free tier is geo-restricted and
  > not currently available in Bosnia/Herzegovina (returns `limit: 0` on every
  > request). Groq has no such restriction. If you ever switch to OpenAI/Claude
  > later, only [src/lib/ai/llm.ts](src/lib/ai/llm.ts) changes.
- `TEST_PATIENT_PHONES` — a comma-separated list of E.164 numbers that will
  overwrite the first patient rows on `npm run db:seed`. **Use only numbers you
  actually own / have whitelisted in Meta.**
- `CRON_SECRET` — already defaulted to `clinicos_cron_2026`, fine for dev.

---

## 1. Whitelist the test recipient phones in Meta

Meta test numbers can only message phones you've explicitly added.

1. Open <https://business.facebook.com/wa/manage/>
2. Pick your WhatsApp Business Account → **API Setup**
3. In the **To** dropdown click **Manage phone number list** → **Add phone number**
4. Add your phone (with country code, e.g. `+38761234567`). You'll get a 6-digit
   confirmation code via WhatsApp; enter it.
5. Repeat for any teammate / friend you want to test with.

> ⚠ When you go to production with a verified business phone number, this whitelist
> step disappears — but you'll need approved templates (next step) for *all* proactive
> outbound messages anyway.

---

## 2. Create the 48 h reminder template

Required because the 48 h reminder is sent **outside** Meta's 24 h
customer-service window. Plain-text outbound is rejected; only approved
templates can be sent.

1. Business Manager → WhatsApp → **Message templates** → **Create template**
2. **Category:** `Utility` (free; transactional category required for booking confirmations)
3. **Name:** `appointment_reminder_48h` (must match the constant in
   [src/jobs/send-message.ts](src/jobs/send-message.ts))
4. **Language:** `Croatian (hr)` — must match the `language` field in
   [src/jobs/send-message.ts](src/jobs/send-message.ts). Change there if you
   pick a different code in Business Manager.
5. **Body** (4 variables, in this order: patient name, date, time, doctor):

   ```
   Postovani {{1}}, podsjecamo Vas na termin {{2}} u {{3}} kod dr. {{4}}. Molimo potvrdite dolazak.
   ```

6. **Buttons → Quick Reply** (add three):
   - `Potvrdi`
   - `Otkazi`
   - `Pomjeri`

7. Submit. Utility templates usually approve in <1 hour.

> The button **payloads** are filled in at send time by the worker:
> `confirm:<apptId>` / `cancel:<apptId>` / `reschedule:<apptId>`. You don't
> configure these in Business Manager — they're injected from
> [src/jobs/send-message.ts](src/jobs/send-message.ts).

The webhook in
[src/app/api/whatsapp/webhook/route.ts](src/app/api/whatsapp/webhook/route.ts)
already decodes those payloads and dispatches `addProcessReplyJob`.

---

## 2b. First-visit Google review template (optional)

After a patient’s **first** appointment is marked **Completed** in the dashboard,
the worker can send **one** WhatsApp template message (5–10 minutes after the
scheduled end time, or ~30 seconds later if staff marks complete much later).
This only runs if **Google review link** is saved under **Settings → Google reviews**
and the `review_request` automation exists and is enabled.

**Database (enum values):** after pulling the code, run once:

```powershell
npm run db:migrate-review-enums
npm run db:seed
```

`db:migrate-review-enums` runs
[scripts/migrate-review-request-enums.ts](scripts/migrate-review-request-enums.ts)
(`review_request` on Postgres enums `message_type` and `automation_type`).  
`db:seed` inserts the default `review_request` automation row if missing.

**Meta template** (must match [src/jobs/send-message.ts](src/jobs/send-message.ts)):

1. WhatsApp → **Message templates** → **Create template**
2. **Category:** `Utility` (or `Marketing` if Meta forces it for “review ask” — your choice)
3. **Name:** `google_review_first_visit`
4. **Language:** `Croatian (hr)` — must match `REVIEW_REQUEST_TEMPLATE.language` in code
5. **Body** — exactly **two** variables, in order: patient name, full review URL (HTTPS):

   ```
   Postovani {{1}}, hvala na prvoj posjeti! Ako imate trenutak, ostavite kratku recenziju na Googleu: {{2}}
   ```

6. Submit and wait for approval.

**Dashboard:** paste your Google Business “Get more reviews” / Maps review URL
(HTTPS) in **Settings → Google reviews** and save.

**Manual E2E**

1. `npm run worker` + `npm run dev` running.
2. Use a patient who has **no** other `completed` appointments in the DB (or create a new patient).
3. Create an appointment, then mark it **Completed** from the calendar/status menu.
4. After the delay (5–10 min after scheduled end, minimum ~30 s), the worker should
   call the Cloud API with template `google_review_first_visit`.
5. Mark a **second** completed appointment for the same patient: no second review
   message should be sent.

---

## 3. Run the local stack

```powershell
# 1. Worker (BullMQ + scheduled scans). Needs Redis. Leave running.
npm run worker

# 2. Next.js dev server. Leave running.
npm run dev

# 3. ngrok tunnel + auto-register webhook with Meta. Leave running.
npm run tunnel
```

`scripts/register-webhook.ts` reads the public ngrok URL, hits Meta Graph API to
subscribe the app to `messages`, then subscribes the WABA to the app.

---

## 4. Seed real phone numbers into the patient DB

In [.env.local](.env.local), set:

```
TEST_PATIENT_PHONES=+38761111111,+38762222222
```

Then:

```powershell
npm run db:seed
```

The first two patient rows (`Marcus Wright`, `Elena Rodriguez`) will get those
numbers. Re-running the seed updates the phones in place.

---

## 5. Verify in the dashboard

- Open `http://localhost:3000/settings`
- Confirm **AI Message Handling** toggle is ON (seed sets this automatically)
- In **Test Messaging** paste your number, click **WhatsApp** → you should
  receive a hello message. If this fails, the rest won't work.

---

## 6. End-to-end test flows

### A. Inbound booking
From your whitelisted phone, message the WhatsApp test number:

> "Trebam termin sutra u 10"

Expected: AI greets you by name (matched by phone), proposes the slot or 5
nearest, and books on your reply.

### B. Inbound cancel / reschedule
Send `Otkazi moj termin` or `Pomjeri termin za petak u 14`. Verify in
`/calendar` that the row updates.

### C. Outbound 48 h reminder

1. Open the calendar, create an appointment 48 h from now.
2. Wait up to 15 min for the scheduled scan, **or** click **Run reminder scan
   now** in `/settings` (added in todo `manual_cron_button`).
3. Your phone should receive the template message with three buttons.
4. Tap **Potvrdi** → appointment status flips to `confirmed`, you receive a
   plain-text ack (within 24 h window so no template needed).

---

## Phase 2 — Instagram + Messenger

The conversation engine (`src/lib/ai/conversation.ts`) and meta webhook
(`src/app/api/meta/webhook/route.ts`) already accept these channels. To turn on:

1. Connect a Facebook Page + Instagram Pro account to the same Meta App
2. Set in [.env.local](.env.local):
   - `META_PAGE_ACCESS_TOKEN` (long-lived Page token)
   - `META_PAGE_ID`
   - `META_WEBHOOK_VERIFY_TOKEN`
3. In Meta App Dashboard → **Webhooks**, subscribe the Page to:
   - `messages`
   - `messaging_postbacks`
   - For Instagram: `instagram_manage_messages`
4. Replace the hardcoded `CLINIC_ID` in
   [src/app/api/meta/webhook/route.ts](src/app/api/meta/webhook/route.ts) with a
   lookup `pageId → clinicId` (stash a `metaPageId` column on `clinics`).
5. Same 24 h messaging window applies — no proactive outbound on these channels
   without the Instagram **Human Agent** tag or Facebook **Message Tags**.

No conversation-engine changes needed; this is pure platform plumbing.
