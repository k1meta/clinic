/**
 * Create or update the ElevenLabs agent from config/voice/agent.ts.
 *
 *   npm run voice:setup -- --url https://your-public-url [--clinic <uuid>] [--dry-run]
 *
 * --url     public address of the app (the ngrok address in development)
 * --clinic  clinic whose data fills in browser tests; needs the database
 *
 * May write VOICE_TOOLS_API_KEY and ELEVENLABS_WEBHOOK_SECRET to .env.local when they
 * are missing or still placeholders. Restart `npm run dev` afterwards.
 */
import { randomBytes } from 'crypto';
import { buildAgentConfig, buildToolConfig, TOOLS } from '../config/voice/agent';
import { buildClinicVariables, FALLBACK_VARIABLES } from '../src/lib/voice/clinic-variables';
import {
  elevenLabs,
  isPlaceholder,
  readFlag,
  readState,
  setEnvValue,
  updateOrCreate,
  writeState,
} from './lib/elevenlabs-api';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const appUrl = (readFlag('url') ?? process.env.VOICE_PUBLIC_URL ?? '').replace(/\/+$/, '');
  if (!/^https:\/\/[^/]+$/.test(appUrl)) {
    throw new Error('Pass the public https address of the app: --url https://example.ngrok.app');
  }

  const clinicId = readFlag('clinic');
  const placeholders = clinicId ? await buildClinicVariables(clinicId) : FALLBACK_VARIABLES;
  if (clinicId && placeholders.service_mode !== 'active') {
    console.warn('! This clinic is missing or has Settings → AI Calls off, so browser tests will refuse to book.');
  }

  const options = {
    ttsModel: process.env.VOICE_TTS_MODEL ?? 'eleven_v3_conversational',
    voiceId: process.env.VOICE_ID || undefined,
    llm: process.env.VOICE_LLM ?? 'claude-haiku-5-5',
    placeholders,
  };

  const state = readState();
  if (dryRun) {
    const secretId = state.secretId ?? '<secret>';
    console.log(JSON.stringify({
      tools: TOOLS.map((tool) => buildToolConfig(tool, { appUrl, secretId })),
      agent: buildAgentConfig({ ...options, appUrl, secretId, toolIds: TOOLS.map((t) => `<${t.name}>`), postCallWebhookId: state.webhookId ?? '<webhook>' }),
    }, null, 2));
    return;
  }

  if (isPlaceholder(process.env.VOICE_TOOLS_API_KEY)) {
    setEnvValue('VOICE_TOOLS_API_KEY', randomBytes(32).toString('hex'));
    console.log('✓ generated VOICE_TOOLS_API_KEY in .env.local');
  }
  const secretValue = `Bearer ${process.env.VOICE_TOOLS_API_KEY}`;

  state.secretId = await updateOrCreate(
    state.secretId,
    (id) => elevenLabs('PATCH', `/v1/convai/secrets/${id}`, { type: 'update', name: 'clinicos_voice_tools', value: secretValue }),
    async () =>
      (await elevenLabs<{ secret_id: string }>('POST', '/v1/convai/secrets', {
        type: 'new',
        name: `clinicos_voice_tools_${Date.now()}`,
        value: secretValue,
      })).secret_id,
  );
  writeState(state);
  console.log('✓ secret');

  // The signing secret is shown only once, and the URL may have changed (new ngrok address).
  const webhookUrl = `${appUrl}/api/voice/elevenlabs/webhook`;
  const { webhooks } = await elevenLabs<{ webhooks: { webhook_id: string; webhook_url: string }[] }>('GET', '/v1/workspace/webhooks');
  const current = webhooks.find((w) => w.webhook_id === state.webhookId);
  if (!current || current.webhook_url !== webhookUrl || isPlaceholder(process.env.ELEVENLABS_WEBHOOK_SECRET)) {
    const created = await elevenLabs<{ webhook_id: string; webhook_secret: string | null }>('POST', '/v1/workspace/webhooks', {
      settings: { auth_type: 'hmac', name: 'ClinicOS post-call', webhook_url: webhookUrl },
    });
    if (!created.webhook_secret) throw new Error('ElevenLabs returned no webhook secret');
    setEnvValue('ELEVENLABS_WEBHOOK_SECRET', created.webhook_secret);
    state.webhookId = created.webhook_id;
    writeState(state);
    console.log('✓ post-call webhook (ELEVENLABS_WEBHOOK_SECRET saved to .env.local)');
    if (current) console.log('  The old "ClinicOS post-call" webhook can be deleted in ElevenLabs → Settings → Webhooks.');
  } else {
    console.log('✓ post-call webhook unchanged');
  }

  const { secretId, webhookId } = state;
  state.toolIds ??= {};
  for (const tool of TOOLS) {
    const tool_config = buildToolConfig(tool, { appUrl, secretId });
    state.toolIds[tool.name] = await updateOrCreate(
      state.toolIds[tool.name],
      (id) => elevenLabs('PATCH', `/v1/convai/tools/${id}`, { tool_config }),
      async () => (await elevenLabs<{ id: string }>('POST', '/v1/convai/tools', { tool_config })).id,
    );
    writeState(state);
    console.log(`✓ tool ${tool.name}`);
  }

  const agent = buildAgentConfig({
    ...options,
    appUrl,
    secretId,
    toolIds: TOOLS.map((tool) => state.toolIds![tool.name]),
    postCallWebhookId: webhookId!,
  });
  state.agentId = await updateOrCreate(
    state.agentId,
    (id) => elevenLabs('PATCH', `/v1/convai/agents/${id}`, agent),
    async () => (await elevenLabs<{ agent_id: string }>('POST', '/v1/convai/agents/create', agent)).agent_id,
  );
  writeState(state);

  console.log(`✓ agent ${state.agentId}`);
  console.log('\nRestart `npm run dev`, then test: https://elevenlabs.io/app/agents');
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
