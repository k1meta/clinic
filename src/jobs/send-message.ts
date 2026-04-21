import { db } from '@/db';
import { appointments, patients, doctors } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendMessage, buildMessageContent } from '@/lib/messaging';
import type { SendMessageJobData } from '@/lib/queue';

export async function processSendMessage(data: SendMessageJobData) {
  const { clinicId, patientId, appointmentId, type } = data;

  // Get patient info
  const [patient] = await db
    .select({ fullName: patients.fullName, phone: patients.phone })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient?.phone) {
    console.log('Skipping message: patient has no phone', patientId);
    return;
  }

  let doctorName = '';
  let date = '';
  let time = '';

  if (appointmentId) {
    const [apt] = await db
      .select({
        startsAt: appointments.startsAt,
        doctorId: appointments.doctorId,
      })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);

    if (apt) {
      const [doc] = await db
        .select({ fullName: doctors.fullName })
        .from(doctors)
        .where(eq(doctors.id, apt.doctorId))
        .limit(1);

      doctorName = doc?.fullName ?? '';
      const d = new Date(apt.startsAt);
      date = d.toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
      time = d.toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });
    }
  }

  // Build message content from template
  const content = await buildMessageContent(clinicId, type, {
    patient_name: patient.fullName,
    date,
    time,
    doctor: doctorName,
  });

  // Choose channel: SMS for 2h nudge, WhatsApp for everything else
  const channel = type === 'reminder_2h' ? 'sms' : 'whatsapp';

  await sendMessage({
    clinicId,
    patientId,
    appointmentId,
    channel,
    type,
    content,
  });
}
