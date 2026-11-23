import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { buildToolConfig, FIRST_MESSAGE, IDENTITY_PROPERTIES, SYSTEM_PROMPT, TOOLS } from '../config/voice/agent';
import { parsePostCall } from '@/lib/channels/voice/elevenlabs';
import { phoneDigitVariants, toE164 } from '@/lib/phone';
import { verifyElevenLabsSignature, verifyVoiceBearer } from '@/lib/voice/auth';
import { isOverlapViolation } from '@/lib/voice/booking-service';
import { resolveClinicId } from '@/lib/voice/clinic-routing';
import { FALLBACK_VARIABLES } from '@/lib/voice/clinic-variables';
import { bhTelecomMobileCodes } from '@/lib/voice/forwarding';
import { describeError } from '@/lib/voice/log';
import { nameMatches, sameFullName } from '@/lib/voice/names';
import { chooseBookingPatient, chooseVerifiedPatient, PLACEHOLDER_PATIENT_NAME, type PatientRow } from '@/lib/voice/patients';
import { IDENTITY_FIELDS, parseVoiceToolRequest, readTime } from '@/lib/voice/tool-request';

const CALLER = '+38761111222';
const OTHER = '+38762333444';
const patient = (id: string, fullName: string, phone = CALLER): PatientRow => ({ id, fullName, phone, status: 'active' });

test('every spelling of a Bosnian number is the same number', () => {
  for (const raw of ['061 111 222', '061/111-222', '+387 61 111 222', '00387 61 111 222', '38761111222', '+387 (0)61 111 222', '61111222']) {
    assert.equal(toE164(raw), CALLER, raw);
  }
  assert.equal(toE164('+49 30 1234567'), '+49301234567');
  for (const raw of ['anonymous', '', null, undefined, '123', '+0611112222']) assert.equal(toE164(raw), null, String(raw));
  assert.ok(phoneDigitVariants(CALLER).includes('061111222'));
  assert.deepEqual(phoneDigitVariants('anonymous'), []);
});

test('names ignore case, diacritics, order and titles', () => {
  assert.ok(sameFullName('hodzic AMRA', 'Amra Hodžić'));
  assert.ok(sameFullName('Đenan Ćosić', 'Denan Cosic'));
  assert.ok(!sameFullName('Amra', 'Amra Hodžić'));
  assert.ok(nameMatches('doktor Aris', 'Dr. Julian Aris'));
  assert.ok(!nameMatches('', 'Amra Hodžić'));
  assert.ok(!nameMatches('doktor', 'Dr. Julian Aris'));
});

test('bearer check fails closed', () => {
  assert.equal(verifyVoiceBearer('Bearer key', 'key'), true);
  assert.equal(verifyVoiceBearer('Bearer nope', 'key'), false);
  assert.equal(verifyVoiceBearer(null, 'key'), false);
  assert.equal(verifyVoiceBearer('Bearer ', ''), false);
  assert.equal(verifyVoiceBearer('Bearer replace_me', 'replace_me'), false);
});

test('webhook signature fails closed and rejects tampering and replay', () => {
  const now = 1_800_000_000_000;
  const sign = (body: string, at: number, secret = 's3cret') => {
    const t = Math.floor(at / 1000);
    return `t=${t},v0=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
  };
  const check = (body: string, header: string | null, secret = 's3cret') => verifyElevenLabsSignature(body, header, secret, now);
  assert.equal(check('{}', sign('{}', now)), true);
  assert.equal(check('{"x":1}', sign('{}', now)), false);
  assert.equal(check('{}', sign('{}', now, 'wrong')), false);
  assert.equal(check('{}', sign('{}', now - 31 * 60_000)), false);
  assert.equal(check('{}', sign('{}', now + 10 * 60_000)), false);
  assert.equal(check('{}', null), false);
  assert.equal(check('{}', sign('{}', now, ''), ''), false);
  assert.equal(check('{}', 'garbage'), false);
});

test('routes reject unauthenticated calls, including the old Retell header', async () => {
  const routes = await Promise.all([
    import('@/app/api/voice/tools/identify-caller/route'),
    import('@/app/api/voice/tools/check-availability/route'),
    import('@/app/api/voice/tools/book/route'),
    import('@/app/api/voice/tools/reschedule/route'),
    import('@/app/api/voice/tools/cancel/route'),
    import('@/app/api/voice/tools/take-message/route'),
    import('@/app/api/voice/elevenlabs/initiation/route'),
    import('@/app/api/voice/elevenlabs/webhook/route'),
  ]);
  delete process.env.VOICE_TOOLS_API_KEY;
  delete process.env.ELEVENLABS_WEBHOOK_SECRET;
  for (const { POST } of routes) {
    const response = await POST(
      new NextRequest('http://localhost/api', {
        method: 'POST',
        headers: { 'x-retell-signature': 'anything', authorization: 'Bearer ' },
        body: JSON.stringify({ conversation_id: 'c1' }),
      }),
    );
    assert.equal(response.status, 401);
  }
});

test('identity fields are separated from model-written arguments', () => {
  const parsed = parseVoiceToolRequest({
    conversation_id: 'conv_1', caller_number: '38761111222', called_number: '+38733000111', phone: OTHER, clinicId: 'x',
  });
  assert.deepEqual(parsed, {
    conversationId: 'conv_1', callerNumber: CALLER, calledNumber: '+38733000111', args: { phone: OTHER, clinicId: 'x' },
  });
  const hidden = parseVoiceToolRequest({ conversation_id: 'c', caller_number: 'anonymous', phone: OTHER });
  assert.equal(hidden?.callerNumber, null, 'a spoken phone never becomes the caller number');
  assert.equal(parseVoiceToolRequest({ phone: OTHER }), null);
  assert.equal(parseVoiceToolRequest([]), null);
  assert.equal(readTime('9:30'), '09:30');
});

test('clinic comes from the called number; the fallback is off in production', async () => {
  const lookup = async (n: string) => (n === '+38733000111' ? 'clinic-a' : null);
  const prod = { NODE_ENV: 'production', DEFAULT_CLINIC_ID: 'demo' };
  const dev = { NODE_ENV: 'development', DEFAULT_CLINIC_ID: 'demo' };
  assert.equal(await resolveClinicId('+38733000111', lookup, prod), 'clinic-a');
  assert.equal(await resolveClinicId('+38733999999', lookup, prod), null);
  assert.equal(await resolveClinicId(null, lookup, prod), null);
  assert.equal(await resolveClinicId(null, lookup, dev), 'demo');
});

test('only caller ID can change an appointment', () => {
  assert.equal(chooseVerifiedPatient([]).ok, false);
  const single = chooseVerifiedPatient([patient('a', 'Amra Hodžić')]);
  assert.ok(single.ok && single.patient.id === 'a');
  const wrongName = chooseVerifiedPatient([patient('a', 'Amra Hodžić')], 'Emir Begić');
  assert.ok(!wrongName.ok && wrongName.code === 'caller_not_verified');
  const family = [patient('a', 'Amra Hodžić'), patient('b', 'Tarik Hodžić')];
  const unnamed = chooseVerifiedPatient(family);
  assert.ok(!unnamed.ok && unnamed.code === 'ambiguous_patient');
  assert.ok(!unnamed.error.includes('Amra'), 'family names are not revealed');
  const named = chooseVerifiedPatient(family, 'Tarik');
  assert.ok(named.ok && named.patient.id === 'b');
});

test('booking picks the right patient', () => {
  const base = { callerNumber: CALLER, callerMatches: [] as PatientRow[], spokenMatches: [] as PatientRow[] };
  const known = [patient('a', 'Amra Hodžić')];

  const self = chooseBookingPatient({ ...base, callerMatches: known });
  assert.ok(self.ok && self.value.kind === 'existing' && self.value.patient.id === 'a');

  const child = chooseBookingPatient({ ...base, callerMatches: known, spokenName: 'Lejla Hodžić' });
  assert.ok(child.ok && child.value.kind === 'new' && child.value.phone === CALLER, 'not booked under the parent');

  const fresh = chooseBookingPatient({ ...base, spokenName: 'Emir Begić' });
  assert.deepEqual(fresh, { ok: true, value: { kind: 'new', fullName: 'Emir Begić', phone: CALLER } });

  const firstNameOnly = chooseBookingPatient({ ...base, spokenName: 'Emir' });
  assert.ok(!firstNameOnly.ok && firstNameOnly.code === 'missing_patient_name');

  const hidden = chooseBookingPatient({ ...base, callerNumber: null, spokenName: 'Emir Begić' });
  assert.ok(!hidden.ok && hidden.code === 'missing_patient_phone');

  const badPhone = chooseBookingPatient({ ...base, callerNumber: null, spokenName: 'Emir Begić', spokenPhone: '12' });
  assert.ok(!badPhone.ok && badPhone.code === 'missing_patient_phone');

  const strangersPhone = chooseBookingPatient({
    ...base, spokenName: 'Emir Begić', spokenPhone: OTHER, spokenMatches: [patient('z', 'Selma Kurtović', OTHER)],
  });
  assert.ok(strangersPhone.ok && strangersPhone.value.kind === 'new', 'a spoken phone alone never selects a patient');

  const renamed = chooseBookingPatient({ ...base, callerMatches: [patient('p', PLACEHOLDER_PATIENT_NAME)], spokenName: 'Emir Begić' });
  assert.ok(renamed.ok && renamed.value.kind === 'existing' && renamed.value.renameTo === 'Emir Begić');
});

test('constraint violations are recognised through wrapped errors', () => {
  assert.equal(isOverlapViolation({ cause: { cause: { code: '23P01' } } }), true);
  assert.equal(isOverlapViolation({ code: '23505' }), false);
  assert.equal(isOverlapViolation(null), false);
});

test('agent tools bind identity to the phone network and match the server', () => {
  assert.deepEqual(Object.keys(IDENTITY_PROPERTIES).sort(), [...IDENTITY_FIELDS].sort());
  for (const tool of TOOLS) {
    const { properties, required } = buildToolConfig(tool, { appUrl: 'https://x.test', secretId: 's' }).api_schema.request_body_schema;
    for (const field of IDENTITY_FIELDS) {
      assert.ok('dynamic_variable' in properties[field] && !('description' in properties[field]), `${tool.name}.${field}`);
      assert.ok(!(field in tool.properties));
    }
    for (const field of required) assert.ok(field in properties, `${tool.name} requires unknown ${field}`);
    assert.ok(!('clinicId' in properties) && !('clinic_id' in properties));
  }
  for (const name of ['reschedule_appointment', 'cancel_appointment']) {
    assert.ok(!('phone' in TOOLS.find((t) => t.name === name)!.properties), `${name} must not accept a phone`);
  }
});

test('every prompt variable is supplied by the initiation webhook', () => {
  const used = [...(SYSTEM_PROMPT + FIRST_MESSAGE).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  assert.ok(used.length > 0);
  for (const name of used) assert.ok(name in FALLBACK_VARIABLES, name);
});

test('post-call payloads are reduced to what is stored', () => {
  const record = parsePostCall({
    type: 'post_call_transcription',
    data: {
      conversation_id: 'conv_1',
      transcript: [{ role: 'agent', message: 'Dobar dan' }, { role: 'agent', message: null }, { role: 'user', message: 'Trebam termin' }],
      analysis: { transcript_summary: 'Zakazan termin', call_successful: 'success' },
      metadata: {
        start_time_unix_secs: 1_800_000_000,
        call_duration_secs: 61,
        phone_call: { type: 'sip_trunking', direction: 'inbound', external_number: '+38761111222', agent_number: '38733000111' },
      },
      conversation_initiation_client_data: { dynamic_variables: { secret__x: 'hidden' } },
    },
  });
  assert.equal(record?.callerNumber, CALLER);
  assert.equal(record?.calledNumber, '+38733000111');
  assert.equal(record?.transcript, 'agent: Dobar dan\nuser: Trebam termin');
  assert.equal(record?.endedAt?.getTime(), 1_800_000_061_000);
  assert.ok(!JSON.stringify(record).includes('hidden'));
  assert.equal(parsePostCall({ type: 'post_call_audio', data: { conversation_id: 'c' } }), null);
  assert.equal(parsePostCall({ type: 'call_initiation_failure', data: { conversation_id: 'c' } })?.failed, true);
  assert.equal(parsePostCall(null), null);
});

test('forwarding codes use the local format and refuse foreign numbers', () => {
  assert.equal(bhTelecomMobileCodes('+38733123456')[0].code, '**61*033123456#');
  assert.deepEqual(bhTelecomMobileCodes('+38512345678'), []);
});

test('error logs never contain query parameters', () => {
  const wrapped = new Error('Failed query: select\nparams: +38761111222', { cause: new Error('connect ENOTFOUND') });
  assert.equal(describeError(wrapped), 'connect ENOTFOUND');
  assert.equal(describeError(new Error('Failed query: x params: +38761111222')), 'database query failed');
});
