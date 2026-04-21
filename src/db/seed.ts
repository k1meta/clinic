import { config } from 'dotenv';
config({ path: '.env.local' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { clinics } from './schema/clinics';
import { doctors } from './schema/doctors';
import { treatmentTypes } from './schema/treatment-types';
import { patients } from './schema/patients';
import { appointments } from './schema/appointments';

const DEMO_CLINIC_ID = '00000000-0000-0000-0000-000000000001';

async function seed() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  console.log('Seeding database...');

  // 1. Clinic
  await db.insert(clinics).values({
    id: DEMO_CLINIC_ID,
    name: 'Primary Care Center',
    slug: 'primary-care',
    timezone: 'Europe/Sarajevo',
    phone: '+387 33 123 456',
  }).onConflictDoNothing();

  // 2. Doctors
  const doctorValues = [
    { id: '00000000-0000-0000-0000-000000000010', clinicId: DEMO_CLINIC_ID, fullName: 'Dr. Julian Aris', specialty: 'Cardiology' },
    { id: '00000000-0000-0000-0000-000000000011', clinicId: DEMO_CLINIC_ID, fullName: 'Dr. Sarah Chen', specialty: 'Pediatrics' },
    { id: '00000000-0000-0000-0000-000000000012', clinicId: DEMO_CLINIC_ID, fullName: 'Dr. Marcus Thorne', specialty: 'General Practice' },
  ];
  for (const d of doctorValues) {
    await db.insert(doctors).values(d).onConflictDoNothing();
  }

  // 3. Treatment Types
  const treatmentValues = [
    { id: '00000000-0000-0000-0000-000000000020', clinicId: DEMO_CLINIC_ID, name: 'Annual Physical', defaultDurationMin: 60 },
    { id: '00000000-0000-0000-0000-000000000021', clinicId: DEMO_CLINIC_ID, name: 'Follow-up', defaultDurationMin: 30 },
    { id: '00000000-0000-0000-0000-000000000022', clinicId: DEMO_CLINIC_ID, name: 'Echocardiogram', defaultDurationMin: 60 },
    { id: '00000000-0000-0000-0000-000000000023', clinicId: DEMO_CLINIC_ID, name: 'Vaccination', defaultDurationMin: 20 },
    { id: '00000000-0000-0000-0000-000000000024', clinicId: DEMO_CLINIC_ID, name: 'Consultation', defaultDurationMin: 45 },
    { id: '00000000-0000-0000-0000-000000000025', clinicId: DEMO_CLINIC_ID, name: 'New Patient Checkup', defaultDurationMin: 90 },
    { id: '00000000-0000-0000-0000-000000000026', clinicId: DEMO_CLINIC_ID, name: 'Dermatology Consult', defaultDurationMin: 30 },
    { id: '00000000-0000-0000-0000-000000000027', clinicId: DEMO_CLINIC_ID, name: 'Cardiac Stress Test', defaultDurationMin: 45 },
  ];
  for (const t of treatmentValues) {
    await db.insert(treatmentTypes).values(t).onConflictDoNothing();
  }

  // 4. Patients
  const patientValues = [
    { id: '00000000-0000-0000-0000-000000000100', clinicId: DEMO_CLINIC_ID, fullName: 'Marcus Wright', phone: '(555) 101-0001', email: 'marcus.wright@email.com', dob: '1985-03-15', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000101', clinicId: DEMO_CLINIC_ID, fullName: 'Elena Rodriguez', phone: '(555) 101-0002', email: 'elena.rodriguez@email.com', dob: '1972-07-22', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000102', clinicId: DEMO_CLINIC_ID, fullName: 'Samuel Oak', phone: '(555) 101-0003', email: 'samuel.oak@email.com', dob: '1990-11-08', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000103', clinicId: DEMO_CLINIC_ID, fullName: 'Baby Liam Garcia', phone: '(555) 101-0004', email: 'garcia.family@email.com', dob: '2023-01-20', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000104', clinicId: DEMO_CLINIC_ID, fullName: 'Isabella Garcia', phone: '(555) 101-0005', email: 'isabella.garcia@email.com', dob: '1988-09-03', status: 'new' as const, notes: 'Needs translation assistance' },
    { id: '00000000-0000-0000-0000-000000000105', clinicId: DEMO_CLINIC_ID, fullName: 'Alice Blackwell', phone: '(555) 123-4567', email: 'alice.b@example.com', dob: '1982-05-14', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000106', clinicId: DEMO_CLINIC_ID, fullName: 'Julian Chen', phone: '(555) 987-6543', email: 'j.chen@workplace.com', dob: '1995-01-02', status: 'new' as const },
    { id: '00000000-0000-0000-0000-000000000107', clinicId: DEMO_CLINIC_ID, fullName: 'Robert Harrison', phone: '(555) 444-5566', email: 'rob.harr@provider.net', dob: '1964-09-28', status: 'inactive' as const },
    { id: '00000000-0000-0000-0000-000000000108', clinicId: DEMO_CLINIC_ID, fullName: 'Elena Martinez', phone: '(555) 222-3333', email: 'elena.m@hospital.org', dob: '1978-12-05', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000109', clinicId: DEMO_CLINIC_ID, fullName: 'Samuel Wright', phone: '(555) 777-8899', email: 'swright.design@gmail.com', dob: '1990-02-18', status: 'new' as const },
    { id: '00000000-0000-0000-0000-000000000110', clinicId: DEMO_CLINIC_ID, fullName: 'Thomas Knight', phone: '(555) 333-4444', email: 'tknight@email.com', dob: '1979-06-12', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000111', clinicId: DEMO_CLINIC_ID, fullName: 'Alice Thompson', phone: '(555) 555-6666', email: 'alice.t@email.com', dob: '1993-04-25', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000112', clinicId: DEMO_CLINIC_ID, fullName: 'David Park', phone: '(555) 777-1111', email: 'dpark@email.com', dob: '1987-08-30', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000113', clinicId: DEMO_CLINIC_ID, fullName: 'Sarah Kim', phone: '(555) 888-2222', email: 'sarah.kim@email.com', dob: '1991-12-14', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000114', clinicId: DEMO_CLINIC_ID, fullName: 'Michael Brown', phone: '(555) 999-3333', email: 'mbrown@email.com', dob: '1975-03-07', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000115', clinicId: DEMO_CLINIC_ID, fullName: 'Jennifer Lee', phone: '(555) 111-4444', email: 'jlee@email.com', dob: '1983-10-19', status: 'inactive' as const },
    { id: '00000000-0000-0000-0000-000000000116', clinicId: DEMO_CLINIC_ID, fullName: 'Christopher Davis', phone: '(555) 222-5555', email: 'cdavis@email.com', dob: '1969-07-04', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000117', clinicId: DEMO_CLINIC_ID, fullName: 'Amanda Wilson', phone: '(555) 333-6666', email: 'awilson@email.com', dob: '1996-01-30', status: 'new' as const },
    { id: '00000000-0000-0000-0000-000000000118', clinicId: DEMO_CLINIC_ID, fullName: 'Daniel Taylor', phone: '(555) 444-7777', email: 'dtaylor@email.com', dob: '1981-11-22', status: 'active' as const },
    { id: '00000000-0000-0000-0000-000000000119', clinicId: DEMO_CLINIC_ID, fullName: 'Sophia Anderson', phone: '(555) 555-8888', email: 'sanderson@email.com', dob: '1994-05-16', status: 'active' as const },
  ];
  for (const p of patientValues) {
    await db.insert(patients).values(p).onConflictDoNothing();
  }

  // 5. Appointments for today and this week
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function dayAt(dayOffset: number, hour: number, minute: number) {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  function addMin(d: Date, min: number) {
    return new Date(d.getTime() + min * 60000);
  }

  const apptValues = [
    // Today - Dr. Aris
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[0].id, doctorId: doctorValues[0].id, treatmentTypeId: treatmentValues[1].id, startsAt: dayAt(0, 8, 15), endsAt: dayAt(0, 8, 45), status: 'completed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[1].id, doctorId: doctorValues[0].id, treatmentTypeId: treatmentValues[2].id, startsAt: dayAt(0, 9, 0), endsAt: dayAt(0, 10, 0), status: 'arrived' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[2].id, doctorId: doctorValues[0].id, treatmentTypeId: treatmentValues[4].id, startsAt: dayAt(0, 10, 15), endsAt: dayAt(0, 11, 0), status: 'confirmed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[12].id, doctorId: doctorValues[0].id, treatmentTypeId: treatmentValues[7].id, startsAt: dayAt(0, 13, 30), endsAt: dayAt(0, 14, 15), status: 'confirmed' as const },
    // Today - Dr. Chen
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[3].id, doctorId: doctorValues[1].id, treatmentTypeId: treatmentValues[3].id, startsAt: dayAt(0, 8, 30), endsAt: dayAt(0, 9, 15), status: 'confirmed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[4].id, doctorId: doctorValues[1].id, treatmentTypeId: treatmentValues[5].id, startsAt: dayAt(0, 13, 0), endsAt: dayAt(0, 14, 30), status: 'confirmed' as const },
    // Today - Dr. Thorne
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[5].id, doctorId: doctorValues[2].id, treatmentTypeId: treatmentValues[0].id, startsAt: dayAt(0, 10, 30), endsAt: dayAt(0, 11, 30), status: 'confirmed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[6].id, doctorId: doctorValues[2].id, treatmentTypeId: treatmentValues[6].id, startsAt: dayAt(0, 11, 15), endsAt: dayAt(0, 11, 45), status: 'confirmed' as const },
    // Tomorrow
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[7].id, doctorId: doctorValues[0].id, treatmentTypeId: treatmentValues[0].id, startsAt: dayAt(1, 9, 0), endsAt: dayAt(1, 10, 0), status: 'confirmed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[8].id, doctorId: doctorValues[1].id, treatmentTypeId: treatmentValues[4].id, startsAt: dayAt(1, 10, 0), endsAt: dayAt(1, 10, 45), status: 'confirmed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[9].id, doctorId: doctorValues[2].id, treatmentTypeId: treatmentValues[1].id, startsAt: dayAt(1, 14, 0), endsAt: dayAt(1, 14, 30), status: 'confirmed' as const },
    // Day after tomorrow
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[10].id, doctorId: doctorValues[0].id, treatmentTypeId: treatmentValues[4].id, startsAt: dayAt(2, 8, 0), endsAt: dayAt(2, 8, 45), status: 'confirmed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[11].id, doctorId: doctorValues[1].id, treatmentTypeId: treatmentValues[3].id, startsAt: dayAt(2, 9, 30), endsAt: dayAt(2, 9, 50), status: 'confirmed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[13].id, doctorId: doctorValues[2].id, treatmentTypeId: treatmentValues[5].id, startsAt: dayAt(2, 11, 0), endsAt: dayAt(2, 12, 30), status: 'confirmed' as const },
    // 3 days out
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[14].id, doctorId: doctorValues[0].id, treatmentTypeId: treatmentValues[7].id, startsAt: dayAt(3, 10, 0), endsAt: dayAt(3, 10, 45), status: 'confirmed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[15].id, doctorId: doctorValues[1].id, treatmentTypeId: treatmentValues[0].id, startsAt: dayAt(3, 14, 0), endsAt: dayAt(3, 15, 0), status: 'confirmed' as const },
    // Past - some no-shows for metrics
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[16].id, doctorId: doctorValues[0].id, treatmentTypeId: treatmentValues[1].id, startsAt: dayAt(-1, 9, 0), endsAt: dayAt(-1, 9, 30), status: 'completed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[17].id, doctorId: doctorValues[1].id, treatmentTypeId: treatmentValues[4].id, startsAt: dayAt(-1, 11, 0), endsAt: dayAt(-1, 11, 45), status: 'no_show' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[18].id, doctorId: doctorValues[2].id, treatmentTypeId: treatmentValues[0].id, startsAt: dayAt(-2, 10, 0), endsAt: dayAt(-2, 11, 0), status: 'completed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[19].id, doctorId: doctorValues[0].id, treatmentTypeId: treatmentValues[6].id, startsAt: dayAt(-2, 14, 0), endsAt: dayAt(-2, 14, 30), status: 'completed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[10].id, doctorId: doctorValues[1].id, treatmentTypeId: treatmentValues[3].id, startsAt: dayAt(-3, 8, 0), endsAt: dayAt(-3, 8, 20), status: 'completed' as const },
    { clinicId: DEMO_CLINIC_ID, patientId: patientValues[11].id, doctorId: doctorValues[2].id, treatmentTypeId: treatmentValues[4].id, startsAt: dayAt(-3, 13, 0), endsAt: dayAt(-3, 13, 45), status: 'no_show' as const },
  ];

  for (const a of apptValues) {
    await db.insert(appointments).values(a).onConflictDoNothing();
  }

  console.log('Seed complete!');
  console.log(`  - 1 clinic`);
  console.log(`  - ${doctorValues.length} doctors`);
  console.log(`  - ${treatmentValues.length} treatment types`);
  console.log(`  - ${patientValues.length} patients`);
  console.log(`  - ${apptValues.length} appointments`);

  await client.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
