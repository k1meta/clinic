/**
 * Connect a landing number to the agent and to one clinic.
 *
 *   npm run voice:number -- --e164 +38733123456 --clinic <uuid> --provider telnyx
 *
 * Optional SIP login (recommended): VOICE_SIP_USERNAME and VOICE_SIP_PASSWORD in .env.local.
 */
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { clinics, voiceNumbers } from '../src/db/schema';
import { toE164 } from '../src/lib/phone';
import { elevenLabs, readFlag, readState } from './lib/elevenlabs-api';

async function main() {
  const raw = readFlag('e164');
  const clinicId = readFlag('clinic');
  const provider = readFlag('provider') ?? 'sip_test';
  const e164 = toE164(raw);
  if (!e164 || !raw?.startsWith('+') || !clinicId) {
    throw new Error('Usage: npm run voice:number -- --e164 +38733123456 --clinic <uuid> --provider telnyx');
  }

  const { agentId } = readState();
  if (!agentId) throw new Error('Run npm run voice:setup first.');

  const [clinic] = await db.select({ name: clinics.name }).from(clinics).where(eq(clinics.id, clinicId)).limit(1);
  if (!clinic) throw new Error(`No clinic ${clinicId}`);

  const [taken] = await db.select().from(voiceNumbers).where(eq(voiceNumbers.e164, e164)).limit(1);
  if (taken && taken.clinicId !== clinicId) throw new Error(`${e164} already belongs to another clinic.`);

  const username = process.env.VOICE_SIP_USERNAME;
  const password = process.env.VOICE_SIP_PASSWORD;
  if (!username || !password) {
    console.warn('! No SIP login set: anyone who knows the number can reach the agent over the internet.');
  }
  const inbound_trunk_config = {
    media_encryption: 'allowed',
    ...(username && password ? { credentials: { username, password } } : {}),
  };

  let phoneNumberId = taken?.elevenlabsPhoneNumberId ?? null;
  if (phoneNumberId) {
    await elevenLabs('PATCH', `/v1/convai/phone-numbers/${phoneNumberId}`, { agent_id: agentId, inbound_trunk_config });
  } else {
    const created = await elevenLabs<{ phone_number_id: string }>('POST', '/v1/convai/phone-numbers', {
      provider: 'sip_trunk',
      phone_number: e164,
      label: `ClinicOS: ${clinic.name}`,
      agent_id: agentId,
      inbound_trunk_config,
    });
    phoneNumberId = created.phone_number_id;
  }

  await db
    .insert(voiceNumbers)
    .values({ clinicId, e164, provider, elevenlabsPhoneNumberId: phoneNumberId })
    .onConflictDoUpdate({
      target: voiceNumbers.e164,
      set: { provider, elevenlabsPhoneNumberId: phoneNumberId, isActive: true, updatedAt: new Date() },
    });

  console.log(`✓ ${e164} → ${clinic.name}`);
  console.log(`  Point the provider's SIP forwarding at: sip:${e164}@sip.rtc.elevenlabs.io:5060;transport=tcp`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
