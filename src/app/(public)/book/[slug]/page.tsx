export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getClinicBySlug } from '@/db/queries/clinics';
import { getTreatmentTypesByClinic } from '@/db/queries/treatment-types';
import BookingWidget from '@/components/BookingWidget';

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string; embed?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const clinic = await getClinicBySlug(slug);
  if (!clinic) notFound();

  const treatments = await getTreatmentTypesByClinic(clinic.id);
  const embed = sp.embed === '1';

  return (
    <div className={embed ? 'min-h-screen bg-transparent p-4' : 'min-h-screen bg-surface-container-low flex items-center justify-center p-4'}>
      <div className="w-full max-w-md">
        {!embed && (
          <div className="text-center mb-6">
            <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">{clinic.name}</h1>
            <p className="text-sm text-on-surface-variant mt-1">Book your appointment online</p>
          </div>
        )}
        <BookingWidget
          slug={clinic.slug}
          treatments={treatments.map((t) => ({ id: t.id, name: t.name }))}
          refCode={sp.ref ?? ''}
        />
      </div>
    </div>
  );
}
