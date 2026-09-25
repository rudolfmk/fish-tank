import { createClient } from "@supabase/supabase-js";
import type { Patient } from "./workspace-data";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);
export const supabase = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export const DEMO_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_PATIENT_ID = "00000000-0000-4000-8000-000000002048";
export const DEMO_APPOINTMENT_ID = "00000000-0000-4000-8000-000000003001";

export async function loadDemoPatient(): Promise<Patient | null> {
  if (!supabase) return null;
  const { data: patient, error } = await supabase
    .from("patients")
    .select("external_patient_id,full_name,date_of_birth,phone,insurance_provider,appointments!inner(reason_for_visit,scheduled_at,status)")
    .eq("organization_id", DEMO_ORGANIZATION_ID)
    .eq("external_patient_id", "PT-2048")
    .limit(1)
    .maybeSingle();
  if (error || !patient) return null;
  const appointments = patient.appointments as unknown as Array<{reason_for_visit:string;scheduled_at:string;status:string}>;
  const appointment = appointments?.[0];
  return {
    id: patient.external_patient_id,
    name: patient.full_name,
    dob: patient.date_of_birth,
    phone: patient.phone || "",
    insurance: patient.insurance_provider || "",
    reason: appointment?.reason_for_visit || "",
    appointment: appointment?.scheduled_at || "",
    status: appointment?.status || "arrived",
  };
}

export async function syncDemoPatient(patient: Patient): Promise<void> {
  if (!supabase) return;
  const { error: patientError } = await supabase.from("patients").upsert({
    id: DEMO_PATIENT_ID,
    organization_id: DEMO_ORGANIZATION_ID,
    external_patient_id: patient.id,
    full_name: patient.name,
    date_of_birth: patient.dob,
    phone: patient.phone,
    insurance_provider: patient.insurance,
    is_synthetic: false,
  }, { onConflict: "organization_id,external_patient_id" });
  if (patientError) throw patientError;
  const { error: appointmentError } = await supabase.from("appointments").upsert({
    id: DEMO_APPOINTMENT_ID,
    organization_id: DEMO_ORGANIZATION_ID,
    patient_id: DEMO_PATIENT_ID,
    scheduled_at: patient.appointment,
    reason_for_visit: patient.reason,
    status: "with_nurse",
    checked_in_at: new Date().toISOString(),
  });
  if (appointmentError) throw appointmentError;
}
