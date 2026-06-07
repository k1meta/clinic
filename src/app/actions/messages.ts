'use server';

import { db } from '@/db';
import { messages } from '@/db/schema';
import { getClinicId } from '@/db/queries/auth';
import { getConversationList, getPatientMessages, getUnreadCount, markThreadRead } from '@/db/queries/messages';
import { sendMessage } from '@/lib/messaging';
import { revalidatePath } from 'next/cache';

export async function getConversations() {
  const clinicId = await getClinicId();
  return getConversationList(clinicId);
}

export async function getThread(patientId: string) {
  const clinicId = await getClinicId();
  await markThreadRead(clinicId, patientId);
  return getPatientMessages(clinicId, patientId);
}

export async function getUnread() {
  const clinicId = await getClinicId();
  return getUnreadCount(clinicId);
}

export async function sendReply(input: { patientId: string; content: string; channel: 'whatsapp' | 'sms' }) {
  const clinicId = await getClinicId();

  try {
    const result = await sendMessage({
      clinicId,
      patientId: input.patientId,
      channel: input.channel,
      type: 'freetext',
      content: input.content,
    });

    if ('skipped' in result) {
      const skippedMessages: Record<string, string> = {
        patient_opted_out: 'This patient has opted out of messages.',
      };
      return { error: skippedMessages[result.skipped] ?? 'Message was not sent.' };
    }

    revalidatePath('/messages');
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send message.';
    return { error: message };
  }
}
