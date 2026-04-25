import ngrok from '@ngrok/ngrok';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const NGROK_AUTHTOKEN        = process.env.NGROK_AUTHTOKEN!;
const META_APP_ID            = process.env.META_APP_ID!;
const META_APP_SECRET        = process.env.META_APP_SECRET!;
const WHATSAPP_ACCESS_TOKEN  = process.env.WHATSAPP_ACCESS_TOKEN!;
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!;
const WHATSAPP_VERIFY_TOKEN  = process.env.WHATSAPP_VERIFY_TOKEN ?? 'clinicos_verify_2026';
const PORT                   = parseInt(process.env.PORT ?? '3000', 10);

function check(name: string, value: string | undefined): void {
  if (!value) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
}

check('NGROK_AUTHTOKEN', NGROK_AUTHTOKEN);
check('META_APP_ID', META_APP_ID);
check('META_APP_SECRET', META_APP_SECRET);
check('WHATSAPP_ACCESS_TOKEN', WHATSAPP_ACCESS_TOKEN);
check('WHATSAPP_BUSINESS_ACCOUNT_ID', WHATSAPP_BUSINESS_ACCOUNT_ID);

async function registerWebhook(publicUrl: string): Promise<void> {
  const callbackUrl = `${publicUrl}/api/whatsapp/webhook`;
  const appToken    = `${META_APP_ID}|${META_APP_SECRET}`;
  const graphBase   = 'https://graph.facebook.com/v21.0';

  // 1. Register app-level subscription
  const subRes = await fetch(`${graphBase}/${META_APP_ID}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object:       'whatsapp_business_account',
      callback_url: callbackUrl,
      verify_token: WHATSAPP_VERIFY_TOKEN,
      fields:       'messages',
      access_token: appToken,
    }),
  });

  const subData = await subRes.json() as Record<string, unknown>;
  if (!subRes.ok || subData.success === false) {
    console.error('Subscription registration failed:', JSON.stringify(subData, null, 2));
    process.exit(1);
  }
  console.log('✓ App subscription registered');

  // 2. Subscribe WABA to the app
  const wabaRes = await fetch(
    `${graphBase}/${WHATSAPP_BUSINESS_ACCOUNT_ID}/subscribed_apps`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
    },
  );

  const wabaData = await wabaRes.json() as Record<string, unknown>;
  if (!wabaRes.ok || wabaData.success === false) {
    console.error('WABA subscription failed:', JSON.stringify(wabaData, null, 2));
    process.exit(1);
  }
  console.log('✓ WABA subscribed to app');
}

async function main(): Promise<void> {
  console.log(`Starting ngrok tunnel → localhost:${PORT} …`);

  const listener = await ngrok.forward({
    addr:      PORT,
    authtoken: NGROK_AUTHTOKEN,
  });

  const publicUrl = listener.url()!;
  console.log(`Tunnel: ${publicUrl}`);
  console.log(`Webhook endpoint: ${publicUrl}/api/whatsapp/webhook`);
  console.log('');
  console.log('Registering with Meta Graph API …');

  await registerWebhook(publicUrl);

  console.log('');
  console.log('Webhook registered ✓');
  console.log(`Tunnel is live. Keep this process running while testing.`);
  console.log('Press Ctrl+C to stop.');

  // Keep alive — infinite promise holds the process open on Windows too
  process.on('SIGINT', async () => {
    console.log('\nClosing tunnel …');
    await listener.close();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await listener.close();
    process.exit(0);
  });

  // setInterval forces the Node.js event loop to stay alive on Windows
  const keepAlive = setInterval(() => {}, 60_000);
  await new Promise<void>(() => { /* never resolves */ });
  clearInterval(keepAlive);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});