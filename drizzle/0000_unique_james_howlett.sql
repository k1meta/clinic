CREATE TYPE "public"."appointment_source" AS ENUM('manual', 'voice_ai', 'online', 'whatsapp_ai', 'instagram_ai', 'messenger_ai');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('confirmed', 'arrived', 'completed', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."automation_type" AS ENUM('reminder_48h', 'reminder_2h', 'post_visit', 're_engagement', 'review_request');--> statement-breakpoint
CREATE TYPE "public"."call_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'transferred');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('whatsapp', 'sms', 'email', 'instagram', 'messenger');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('reminder_48h', 'reminder_2h', 'post_visit', 're_engagement', 'review_request', 'confirmation', 'cancellation', 'reschedule', 'freetext', 'system');--> statement-breakpoint
CREATE TYPE "public"."patient_status" AS ENUM('new', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'partial', 'paid', 'waived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'receptionist', 'doctor');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"treatment_type_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'confirmed' NOT NULL,
	"source" "appointment_source" DEFAULT 'manual' NOT NULL,
	"amount_charged" integer,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"type" "automation_type" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"template_content" text NOT NULL,
	"quiet_hours_start" integer DEFAULT 21 NOT NULL,
	"quiet_hours_end" integer DEFAULT 8 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid,
	"appointment_id" uuid,
	"provider" text DEFAULT 'retell' NOT NULL,
	"provider_call_id" text NOT NULL,
	"direction" "call_direction" DEFAULT 'inbound' NOT NULL,
	"status" "call_status" DEFAULT 'initiated' NOT NULL,
	"from_number" text,
	"to_number" text,
	"language" text DEFAULT 'bs-BA' NOT NULL,
	"transcript" text,
	"summary" text,
	"outcome" text,
	"duration_sec" integer,
	"metadata" jsonb,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calls_provider_call_id_unique" UNIQUE("provider_call_id")
);
--> statement-breakpoint
CREATE TABLE "clinics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Sarajevo' NOT NULL,
	"phone" text,
	"logo_url" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"specialty" text NOT NULL,
	"schedule" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"channel" "message_channel" NOT NULL,
	"direction" "message_direction" NOT NULL,
	"type" "message_type" NOT NULL,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"content" text NOT NULL,
	"external_id" text,
	"metadata" jsonb,
	"read_by_staff" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"email" text,
	"dob" date,
	"gender" text,
	"address" text,
	"emergency_contact" text,
	"status" "patient_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"opt_out_at" timestamp with time zone,
	"whatsapp_id" text,
	"instagram_id" text,
	"messenger_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatment_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"name" text NOT NULL,
	"default_duration_min" integer DEFAULT 30 NOT NULL,
	"price" integer,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurring_interval_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" DEFAULT 'receptionist' NOT NULL,
	"clerk_user_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_treatment_type_id_treatment_types_id_fk" FOREIGN KEY ("treatment_type_id") REFERENCES "public"."treatment_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_types" ADD CONSTRAINT "treatment_types_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;