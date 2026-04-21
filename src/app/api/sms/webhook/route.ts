import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { messages, patients } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** POST: Twilio inbound SMS webhook */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;

    if (!from || !body) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Normalize phone: strip + prefix for matching
    const normalizedPhone = from.replace(/^\+/, '');

    // Find patient
    const [patient] = await db
      .select({ id: patients.id, clinicId: patients.clinicId })
      .from(patients)
      .where(eq(patients.phone, normalizedPhone))
      .limit(1);

    if (patient) {
      await db.insert(messages).values({
        clinicId: patient.clinicId,
        patientId: patient.id,
        channel: 'sms',
        direction: 'inbound',
        type: 'freetext',
        status: 'delivered',
        content: body,
        externalId: messageSid,
        readByStaff: false,
      });
    }

    // Return TwiML empty response
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[sms-webhook] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
