import { NextResponse, type NextRequest } from 'next/server';
import { toE164 } from '@/lib/phone';
import { verifyVoiceBearer } from '@/lib/voice/auth';
import { logVoiceError } from '@/lib/voice/log';
import { resolveClinicId } from '@/lib/voice/clinic-routing';
import { buildClinicVariables, FALLBACK_VARIABLES } from '@/lib/voice/clinic-variables';

/**
 * ElevenLabs calls this while the phone is still ringing. The answer must contain
 * every variable the agent uses, so failures fall back to a safe greeting.
 */
export async function POST(request: NextRequest) {
  if (!verifyVoiceBearer(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let variables = FALLBACK_VARIABLES;
  try {
    const body = (await request.json()) as { called_number?: unknown };
    const called = typeof body.called_number === 'string' ? toE164(body.called_number) : null;
    const clinicId = await resolveClinicId(called);
    if (clinicId) variables = await buildClinicVariables(clinicId);
    else console.warn('[voice] initiation: called number is not registered');
  } catch (error) {
    logVoiceError('initiation failed', error);
  }

  return NextResponse.json({ type: 'conversation_initiation_client_data', dynamic_variables: variables });
}
