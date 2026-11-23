import { NextResponse, type NextRequest } from 'next/server';
import { getClinicSettings } from '@/db/queries/clinics';
import { verifyVoiceBearer } from '@/lib/voice/auth';
import type { VoiceContext } from '@/lib/voice/call-log';
import { resolveClinicId } from '@/lib/voice/clinic-routing';
import { logVoiceError } from '@/lib/voice/log';
import { parseVoiceToolRequest } from '@/lib/voice/tool-request';

type ToolReply =
  | { ok: true; message: string; data?: Record<string, unknown> }
  | { ok: false; error: string; code: string; data?: Record<string, unknown> };

/**
 * Business failures use HTTP 200: the agent must read `message` and recover, whereas
 * a non-2xx status is treated by ElevenLabs as a broken tool.
 */
function reply(result: ToolReply, status = 200) {
  return NextResponse.json(
    result.ok
      ? { success: true, message: result.message, ...(result.data ? { data: result.data } : {}) }
      : { success: false, code: result.code, message: result.error, ...(result.data ? { data: result.data } : {}) },
    { status },
  );
}

/** Auth, parsing and clinic routing shared by every /api/voice/tools route. */
export function voiceTool(
  handler: (ctx: VoiceContext, args: Record<string, unknown>) => Promise<ToolReply>,
) {
  return async function POST(request: NextRequest) {
    if (!verifyVoiceBearer(request.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = parseVoiceToolRequest(body);
    if (!parsed) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

    try {
      const clinicId = await resolveClinicId(parsed.calledNumber);
      if (!clinicId) {
        return reply({ ok: false, code: 'unknown_number', error: 'Ovaj broj nije povezan s ordinacijom.' });
      }
      const settings = await getClinicSettings(clinicId);
      if (!settings.aiCalls) {
        return reply({
          ok: false,
          code: 'ai_calls_disabled',
          error: 'Telefonsko zakazivanje je trenutno isključeno. Zamoli pozivaoca da nazove kasnije.',
        });
      }
      return reply(
        await handler(
          {
            clinicId,
            conversationId: parsed.conversationId,
            callerNumber: parsed.callerNumber,
            calledNumber: parsed.calledNumber,
          },
          parsed.args,
        ),
      );
    } catch (error) {
      logVoiceError('tool failed', error);
      return reply(
        {
          ok: false,
          code: 'server_error',
          error: 'Sistem trenutno ne radi. Ne potvrđuj nikakav termin. Zamoli pozivaoca da nazove kasnije.',
        },
        500,
      );
    }
  };
}
