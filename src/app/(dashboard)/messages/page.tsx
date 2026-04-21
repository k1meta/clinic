export const dynamic = 'force-dynamic';

import { getClinicId } from '@/db/queries/auth';
import { getConversationList } from '@/db/queries/messages';
import MessagesInbox from '@/components/MessagesInbox';

export default async function MessagesPage() {
  const clinicId = await getClinicId();
  const conversations = await getConversationList(clinicId);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 shrink-0">
        <nav className="flex mb-2 space-x-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <span>Clinic</span>
          <span>/</span>
          <span className="text-primary">Messages</span>
        </nav>
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">Messages</h1>
        <p className="text-sm text-slate-400 mt-1">Patient conversations via WhatsApp and SMS.</p>
      </div>
      <div className="flex-1 px-8 pb-8 min-h-0">
        <MessagesInbox conversations={conversations} />
      </div>
    </div>
  );
}
