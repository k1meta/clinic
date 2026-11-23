import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { appointments, doctors, patients, messages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendMessage } from '@/lib/messaging';
import { getNextAvailableSlots } from '@/lib/availability';
import { getClinicSettings } from '@/db/queries/clinics';
import { addDays, todayInZone } from '@/lib/timezone';
import { generateConfirmation, generateCancellationAck, generateRescheduleOptions } from '@/lib/ai/messaging';
import type { ProcessReplyJobData } from '@/lib/queue';

function revalidateAppointmentViews() {
  revalidatePath('/');
  revalidatePath('/calendar');
  revalidatePath('/patients');
}

export async function processButtonReply(data: ProcessReplyJobData) {
  const { clinicId, patientId, appointmentId, action } = data;

  const [apt] = await db
    .select({
      startsAt: appointments.startsAt,
      doctorId: appointments.doctorId,
      status: appointments.status,
    })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!apt || apt.status === 'cancelled') return;

  const [patient] = await db
    .select({ fullName: patients.fullName, phone: patients.phone })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient?.phone) return;

  const [doctor] = await db
    .select({ fullName: doctors.fullName })
    .from(doctors)
    .where(eq(doctors.id, apt.doctorId))
    .limit(1);

  const { timezone } = await getClinicSettings(clinicId);

  if (action === 'confirm') {
    // Update appointment status
    await db
      .update(appointments)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(eq(appointments.id, appointmentId));

    const d = new Date(apt.startsAt);
    const date = d.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: timezone });
    const time = d.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
    const content = await generateConfirmation(patient.fullName, date, time, doctor?.fullName ?? '');

    await sendMessage({
      clinicId,
      patientId,
      appointmentId,
      channel: 'whatsapp',
      type: 'confirmation',
      content,
    });

    // Log inbound confirmation
    await db.insert(messages).values({
      clinicId,
      patientId,
      appointmentId,
      channel: 'whatsapp',
      direction: 'inbound',
      type: 'confirmation',
      status: 'delivered',
      content: 'Potvrdio/la dolazak',
    });

    revalidateAppointmentViews();

  } else if (action === 'cancel') {
    await db
      .update(appointments)
      .set({ status: 'cancelled', cancelledReason: 'Patient cancelled via WhatsApp', updatedAt: new Date() })
      .where(eq(appointments.id, appointmentId));

    const content = await generateCancellationAck(patient.fullName);

    await sendMessage({
      clinicId,
      patientId,
      appointmentId,
      channel: 'whatsapp',
      type: 'cancellation',
      content,
    });

    revalidateAppointmentViews();

  } else if (action === 'reschedule') {
    // Find available slots
    const fromDate = addDays(todayInZone(timezone), 1);

    const slots = await getNextAvailableSlots(clinicId, apt.doctorId, fromDate, 30, 5);
    const content = await generateRescheduleOptions(patient.fullName, slots);

    await sendMessage({
      clinicId,
      patientId,
      appointmentId,
      channel: 'whatsapp',
      type: 'reschedule',
      content,
      metadata: { slots, oldAppointmentId: appointmentId, doctorId: apt.doctorId },
    });

    revalidateAppointmentViews();
  }
}
