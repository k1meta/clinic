# ClinicOS

Front-office dashboard for appointment businesses in BiH: calendar, patients, WhatsApp/SMS reminders, and an AI that answers calls the business can't take.

```bash
npm install
npm run dev       # http://localhost:3000, needs .env.local
npm run worker    # reminders and queued messages
npm test
```

- `CLAUDE.md`: stack, layout, rules, commands
- `VOICE_AI_SETUP.md`: phone agent
- `WHATSAPP_SETUP.md`: WhatsApp
- `config/voice/PILOT_BCS.md`: phone test plan
