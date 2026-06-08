export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getClinicId } from '@/db/queries/auth';
import { getCallById } from '@/db/queries/calls';
import CallTranscriptPanel from '@/components/CallTranscriptPanel';

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clinicId = await getClinicId();
  const call = await getCallById(clinicId, id);

  if (!call) notFound();

  return (
    <div className="p-8 overflow-y-auto space-y-6">
      <div>
        <Link
          href="/voice-ai"
          className="text-xs font-semibold text-primary hover:underline"
        >
          ← Back to Voice AI
        </Link>
        <h2 className="text-2xl font-black font-headline tracking-tight text-on-surface mt-2">
          Call transcript
        </h2>
      </div>
      <CallTranscriptPanel calls={[call]} initialCallId={call.id} />
    </div>
  );
}
