-- Clarity Care clinical data schema for Supabase (PostgreSQL).
-- Run this entire file in the Supabase SQL editor on a new project.
-- This file creates structure only: it does not insert patients, diagnoses,
-- histories, allergies, medicines, or any other fabricated clinical data.
-- AI-authored content remains provisional until a clinician reviews it.

begin;

create extension if not exists pgcrypto;

do $$ begin create type public.member_role as enum ('admin','receptionist','nurse','doctor','viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.appointment_status as enum ('scheduled','arrived','with_nurse','waiting_for_doctor','with_doctor','record_review','completed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.encounter_stage as enum ('reception','nurse','doctor','clinical_record','outputs','completed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.speaker_role as enum ('patient','nurse','doctor','unknown'); exception when duplicate_object then null; end $$;
do $$ begin create type public.content_source as enum ('patient','reception','nurse','doctor','ai','unknown'); exception when duplicate_object then null; end $$;
do $$ begin create type public.review_status as enum ('ai_generated','in_review','clinician_verified','superseded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.suggestion_status as enum ('open','addressed','dismissed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.output_audience as enum ('insurance','pharmacy','patient'); exception when duplicate_object then null; end $$;
do $$ begin create type public.processing_status as enum ('pending','processing','completed','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.symptom_trend as enum ('new','improving','stable','worsening','resolved','unknown'); exception when duplicate_object then null; end $$;
do $$ begin create type public.timeline_event_type as enum ('onset','change','treatment','measurement','patient_report','clinician_observation','resolution'); exception when duplicate_object then null; end $$;
do $$ begin create type public.flag_level as enum ('green','red'); exception when duplicate_object then null; end $$;
do $$ begin create type public.flag_status as enum ('active','resolved','dismissed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.prediction_status as enum ('ai_generated','under_review','clinician_supported','clinician_rejected','superseded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.allergy_status as enum ('active','inactive','entered_in_error','unconfirmed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.allergy_severity as enum ('mild','moderate','severe','unknown'); exception when duplicate_object then null; end $$;
do $$ begin create type public.avoidance_status as enum ('ai_generated','clinician_verified','dismissed','superseded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.history_category as enum ('medical','surgical','family','social','medication','allergy','immunization','hospitalization','obstetric','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.summary_section_type as enum ('chief_complaint','symptoms','timeline','history','findings','assessment','plan','medications','allergies','green_flags','red_flags','follow_up','other'); exception when duplicate_object then null; end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  professional_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_patient_id text not null,
  full_name text not null,
  date_of_birth date not null,
  phone text,
  insurance_provider text,
  is_synthetic boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_patient_id)
);

-- Remove the prototype-only restriction when upgrading an older installation.
alter table public.patients drop constraint if exists synthetic_demo_data_only;
alter table public.patients alter column is_synthetic set default false;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  scheduled_at timestamptz not null,
  reason_for_visit text not null,
  status public.appointment_status not null default 'scheduled',
  checked_in_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  stage public.encounter_stage not null default 'reception',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.queue_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  from_stage public.encounter_stage,
  to_stage public.encounter_stage not null,
  actor_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  recorded_by_role public.member_role not null,
  storage_path text not null,
  mime_type text not null,
  duration_seconds numeric(10,2),
  size_bytes bigint,
  processing_status public.processing_status not null default 'pending',
  processing_error text,
  transcription_model text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  recording_id uuid references public.recordings(id) on delete set null,
  context_role public.member_role not null,
  full_text text not null default '',
  language_code text,
  is_final boolean not null default false,
  is_synthetic boolean not null default true,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  sequence_number integer not null,
  speaker_label text not null,
  speaker_role public.speaker_role not null default 'unknown',
  text text not null,
  start_seconds numeric(10,3),
  end_seconds numeric(10,3),
  confidence numeric(5,4),
  created_at timestamptz not null default now(),
  unique (transcript_id, sequence_number),
  constraint segment_time_order check (start_seconds is null or end_seconds is null or end_seconds >= start_seconds),
  constraint segment_confidence_range check (confidence is null or confidence between 0 and 1)
);

create table if not exists public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  status public.processing_status not null default 'pending',
  model text,
  prompt_version text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.extracted_clinical_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  extraction_run_id uuid not null references public.extraction_runs(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  field_key text not null,
  extracted_value text,
  source_type public.content_source not null default 'unknown',
  is_supported boolean not null default false,
  created_at timestamptz not null default now(),
  unique (extraction_run_id, field_key),
  constraint supported_value_has_content check (not is_supported or extracted_value is not null),
  constraint allowed_clinical_field check (field_key in (
    'chief_complaint','symptoms','duration','severity','temperature',
    'blood_pressure','heart_rate','respiratory_rate','oxygen_saturation',
    'weight','medical_history','current_medications','allergies',
    'important_notes','examination_findings','diagnosis','treatment',
    'follow_up_instructions'
  ))
);

create table if not exists public.field_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  extracted_field_id uuid not null references public.extracted_clinical_fields(id) on delete cascade,
  transcript_segment_id uuid references public.transcript_segments(id) on delete set null,
  evidence_quote text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.documentation_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  field_key text not null,
  missing_information text not null,
  suggested_question text not null,
  status public.suggestion_status not null default 'open',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.clinical_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  version integer not null default 1,
  status public.review_status not null default 'ai_generated',
  generated_from_run_id uuid references public.extraction_runs(id) on delete set null,
  verified_by uuid references auth.users(id) on delete restrict,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (encounter_id, version),
  constraint verification_is_complete check (
    (status = 'clinician_verified' and verified_by is not null and verified_at is not null)
    or status <> 'clinician_verified'
  )
);

create table if not exists public.clinical_record_fields (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  clinical_record_id uuid not null references public.clinical_records(id) on delete cascade,
  field_key text not null,
  value text,
  source_type public.content_source not null default 'unknown',
  extracted_field_id uuid references public.extracted_clinical_fields(id) on delete set null,
  clinician_confirmed boolean not null default false,
  edited_by uuid references auth.users(id) on delete set null,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinical_record_id, field_key)
);

create table if not exists public.generated_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  clinical_record_id uuid not null references public.clinical_records(id) on delete restrict,
  audience public.output_audience not null,
  content jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinical_record_id, audience),
  constraint output_is_object check (jsonb_typeof(content) = 'object')
);

-- Longitudinal patient history. A row is a real reported or clinician-entered
-- fact; absence of a row means "not documented", never "no history".
create table if not exists public.patient_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  encounter_id uuid references public.encounters(id) on delete set null,
  category public.history_category not null,
  title text not null check (btrim(title) <> ''),
  details text,
  occurred_on date,
  ended_on date,
  is_active boolean,
  source_type public.content_source not null default 'unknown',
  source_reference text,
  clinician_confirmed boolean not null default false,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_history_date_order check (ended_on is null or occurred_on is null or ended_on >= occurred_on)
);

-- Structured allergies are the source of truth for medicine-avoidance checks.
create table if not exists public.patient_allergies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  substance text not null check (btrim(substance) <> ''),
  reaction text,
  severity public.allergy_severity not null default 'unknown',
  status public.allergy_status not null default 'unconfirmed',
  onset_date date,
  source_type public.content_source not null default 'unknown',
  clinician_confirmed boolean not null default false,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per symptom per encounter. AI confidence is confidence in extraction,
-- not the probability or severity of a disease.
create table if not exists public.symptoms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  description text,
  body_site text,
  onset_at timestamptz,
  resolved_at timestamptz,
  severity_score smallint check (severity_score between 0 and 10),
  trend public.symptom_trend not null default 'unknown',
  frequency text,
  aggravating_factors text,
  relieving_factors text,
  source_type public.content_source not null default 'unknown',
  evidence_quote text,
  ai_confidence numeric(5,4) check (ai_confidence between 0 and 1),
  clinician_confirmed boolean not null default false,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint symptom_time_order check (resolved_at is null or onset_at is null or resolved_at >= onset_at)
);

-- Append-only events provide the symptom timeline. event_at is when the event
-- happened; recorded_at is when the application learned about it.
create table if not exists public.symptom_timeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  symptom_id uuid not null references public.symptoms(id) on delete cascade,
  event_type public.timeline_event_type not null,
  event_at timestamptz not null,
  description text not null check (btrim(description) <> ''),
  severity_score smallint check (severity_score between 0 and 10),
  trend public.symptom_trend,
  source_type public.content_source not null default 'unknown',
  evidence_quote text,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

-- AI suggested questions are prompts for gathering missing information only.
-- They must not be represented as established clinical facts.
create table if not exists public.ai_suggested_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  question text not null check (btrim(question) <> ''),
  rationale text not null check (btrim(rationale) <> ''),
  target_field text,
  priority smallint not null default 3 check (priority between 1 and 5),
  status public.suggestion_status not null default 'open',
  model text,
  prompt_version text,
  answered_text text,
  addressed_by uuid references auth.users(id) on delete set null,
  addressed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint suggested_question_resolution check (
    (status = 'open' and addressed_at is null)
    or (status <> 'open' and addressed_at is not null)
  )
);

-- Differential/possible-condition output. This is deliberately named and
-- constrained as a prediction, never a confirmed diagnosis.
create table if not exists public.disease_predictions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  condition_name text not null check (btrim(condition_name) <> ''),
  condition_code text,
  code_system text,
  rank smallint not null check (rank > 0),
  confidence numeric(5,4) check (confidence between 0 and 1),
  supporting_evidence jsonb not null default '[]'::jsonb,
  contradicting_evidence jsonb not null default '[]'::jsonb,
  explanation text,
  model text not null,
  prompt_version text,
  status public.prediction_status not null default 'ai_generated',
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (encounter_id, rank),
  constraint prediction_support_is_array check (jsonb_typeof(supporting_evidence) = 'array'),
  constraint prediction_contradiction_is_array check (jsonb_typeof(contradicting_evidence) = 'array'),
  constraint prediction_review_complete check (
    (status in ('clinician_supported','clinician_rejected') and reviewed_by is not null and reviewed_at is not null)
    or status not in ('clinician_supported','clinician_rejected')
  )
);

-- Green flags are reassuring findings; red flags are safety concerns. Neither
-- substitutes for a clinician's assessment or an emergency-care instruction.
create table if not exists public.clinical_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  level public.flag_level not null,
  title text not null check (btrim(title) <> ''),
  description text not null check (btrim(description) <> ''),
  recommended_action text,
  source_type public.content_source not null default 'unknown',
  evidence_quote text,
  status public.flag_status not null default 'active',
  clinician_confirmed boolean not null default false,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Each medicine-to-avoid row must point to a documented allergy. A database
-- trigger below also verifies that the allergy belongs to the same patient.
create table if not exists public.medicines_to_avoid (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  encounter_id uuid references public.encounters(id) on delete set null,
  allergy_id uuid not null references public.patient_allergies(id) on delete restrict,
  medicine_name text not null check (btrim(medicine_name) <> ''),
  active_ingredient text,
  drug_class text,
  reason text not null check (btrim(reason) <> ''),
  interaction_basis text,
  status public.avoidance_status not null default 'ai_generated',
  model text,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, allergy_id, medicine_name),
  constraint medicine_avoidance_review_complete check (
    (status = 'clinician_verified' and reviewed_by is not null and reviewed_at is not null)
    or status <> 'clinician_verified'
  )
);

-- Ordered sections let the UI render a transparent summary breakdown instead
-- of storing a single opaque AI paragraph.
create table if not exists public.summary_breakdowns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  clinical_record_id uuid references public.clinical_records(id) on delete cascade,
  section_type public.summary_section_type not null,
  sequence_number integer not null check (sequence_number > 0),
  heading text not null check (btrim(heading) <> ''),
  content text not null check (btrim(content) <> ''),
  evidence jsonb not null default '[]'::jsonb,
  source_type public.content_source not null default 'unknown',
  clinician_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (encounter_id, sequence_number),
  constraint summary_evidence_is_array check (jsonb_typeof(evidence) = 'array')
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  encounter_id uuid references public.encounters(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Database-enforced clinician verification and output gates.
create or replace function public.enforce_clinical_record_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_fields integer := 18;
  confirmed_fields integer;
begin
  if new.status = 'clinician_verified' and (tg_op = 'INSERT' or old.status is distinct from 'clinician_verified') then
    select count(*) into confirmed_fields
    from public.clinical_record_fields f
    where f.clinical_record_id = new.id and f.clinician_confirmed = true;

    if confirmed_fields <> expected_fields then
      raise exception 'Clinical record requires all % fields to be clinician-confirmed before verification; found %', expected_fields, confirmed_fields;
    end if;

    if new.verified_by is null then new.verified_by := auth.uid(); end if;
    if new.verified_by is null then
      raise exception 'verified_by is required when verifying a clinical record';
    end if;
    new.verified_at := coalesce(new.verified_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_clinical_record_verification on public.clinical_records;
create trigger enforce_clinical_record_verification
before update of status on public.clinical_records
for each row execute function public.enforce_clinical_record_verification();
drop trigger if exists enforce_clinical_record_verification_insert on public.clinical_records;
create trigger enforce_clinical_record_verification_insert
before insert on public.clinical_records
for each row when (new.status = 'clinician_verified')
execute function public.enforce_clinical_record_verification();

create or replace function public.enforce_verified_output_source()
returns trigger
language plpgsql
set search_path = ''
as $$
declare source_status public.review_status;
begin
  select r.status into source_status
  from public.clinical_records r
  where r.id = new.clinical_record_id
    and r.organization_id = new.organization_id
    and r.encounter_id = new.encounter_id;

  if source_status is distinct from 'clinician_verified' then
    raise exception 'Stakeholder outputs may only use a clinician-verified clinical record';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_verified_output_source on public.generated_outputs;
create trigger enforce_verified_output_source
before insert or update on public.generated_outputs
for each row execute function public.enforce_verified_output_source();

-- Prevent a child row from combining IDs from different patients or tenants.
-- RLS controls who can access rows; this trigger also protects relational
-- integrity when writes come from the service role.
create or replace function public.enforce_clinical_parentage()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  row_data jsonb := to_jsonb(new);
  patient_uuid uuid := nullif(row_data ->> 'patient_id', '')::uuid;
  encounter_uuid uuid := nullif(row_data ->> 'encounter_id', '')::uuid;
  allergy_uuid uuid := nullif(row_data ->> 'allergy_id', '')::uuid;
  symptom_uuid uuid := nullif(row_data ->> 'symptom_id', '')::uuid;
  record_uuid uuid := nullif(row_data ->> 'clinical_record_id', '')::uuid;
begin
  if patient_uuid is not null and not exists (
    select 1 from public.patients p
    where p.id = patient_uuid and p.organization_id = new.organization_id
  ) then
    raise exception 'patient_id does not belong to organization_id';
  end if;

  if encounter_uuid is not null and not exists (
    select 1 from public.encounters e
    where e.id = encounter_uuid
      and e.organization_id = new.organization_id
      and (patient_uuid is null or e.patient_id = patient_uuid)
  ) then
    raise exception 'encounter_id does not belong to this organization/patient';
  end if;

  if allergy_uuid is not null and not exists (
    select 1 from public.patient_allergies a
    where a.id = allergy_uuid
      and a.organization_id = new.organization_id
      and a.patient_id = patient_uuid
  ) then
    raise exception 'allergy_id does not belong to this organization/patient';
  end if;

  if symptom_uuid is not null and not exists (
    select 1 from public.symptoms s
    where s.id = symptom_uuid
      and s.organization_id = new.organization_id
      and s.patient_id = patient_uuid
      and (encounter_uuid is null or s.encounter_id = encounter_uuid)
  ) then
    raise exception 'symptom_id does not belong to this organization/patient/encounter';
  end if;

  if record_uuid is not null and not exists (
    select 1 from public.clinical_records r
    where r.id = record_uuid
      and r.organization_id = new.organization_id
      and (encounter_uuid is null or r.encounter_id = encounter_uuid)
  ) then
    raise exception 'clinical_record_id does not belong to this organization/encounter';
  end if;

  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'appointments','encounters','patient_history','patient_allergies','symptoms',
    'symptom_timeline_events','ai_suggested_questions','disease_predictions',
    'clinical_flags','medicines_to_avoid','summary_breakdowns'
  ] loop
    execute format('drop trigger if exists enforce_clinical_parentage on public.%I', table_name);
    execute format('create trigger enforce_clinical_parentage before insert or update on public.%I for each row execute function public.enforce_clinical_parentage()', table_name);
  end loop;
end $$;

-- Important lookup and workflow indexes.
create index if not exists patients_org_name_idx on public.patients (organization_id, full_name);
create index if not exists appointments_org_status_time_idx on public.appointments (organization_id, status, scheduled_at);
create index if not exists encounters_org_stage_idx on public.encounters (organization_id, stage, started_at desc);
create index if not exists queue_events_encounter_idx on public.queue_events (encounter_id, created_at);
create index if not exists recordings_encounter_idx on public.recordings (encounter_id, created_at);
create index if not exists transcripts_encounter_idx on public.transcripts (encounter_id, context_role);
create index if not exists transcript_segments_transcript_idx on public.transcript_segments (transcript_id, sequence_number);
create index if not exists extraction_runs_encounter_idx on public.extraction_runs (encounter_id, created_at desc);
create index if not exists extracted_fields_encounter_idx on public.extracted_clinical_fields (encounter_id, field_key);
create index if not exists suggestions_encounter_status_idx on public.documentation_suggestions (encounter_id, status);
create index if not exists records_encounter_status_idx on public.clinical_records (encounter_id, status, version desc);
create index if not exists outputs_encounter_audience_idx on public.generated_outputs (encounter_id, audience);
create index if not exists patient_history_patient_idx on public.patient_history (patient_id, category, occurred_on desc);
create index if not exists patient_allergies_patient_idx on public.patient_allergies (patient_id, status, substance);
create index if not exists symptoms_patient_encounter_idx on public.symptoms (patient_id, encounter_id, created_at);
create index if not exists symptom_timeline_symptom_idx on public.symptom_timeline_events (symptom_id, event_at);
create index if not exists ai_questions_encounter_idx on public.ai_suggested_questions (encounter_id, status, priority);
create index if not exists disease_predictions_encounter_idx on public.disease_predictions (encounter_id, status, rank);
create index if not exists clinical_flags_encounter_idx on public.clinical_flags (encounter_id, level, status);
create index if not exists medicines_to_avoid_patient_idx on public.medicines_to_avoid (patient_id, status, medicine_name);
create index if not exists summary_breakdowns_encounter_idx on public.summary_breakdowns (encounter_id, sequence_number);
create index if not exists audit_org_created_idx on public.audit_events (organization_id, created_at desc);

-- Keep updated_at consistent.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organizations','profiles','patients','appointments','encounters','recordings',
    'transcripts','clinical_records','clinical_record_fields','generated_outputs',
    'patient_history','patient_allergies','symptoms','disease_predictions',
    'clinical_flags','medicines_to_avoid','summary_breakdowns'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

-- RLS helper. SECURITY DEFINER avoids recursive membership policy checks.
create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_organization_id
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, public.member_role[]) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- Remove policies left by an older demo installation. No clinical table is
-- available to Supabase's anonymous role.
drop policy if exists "demo visitors read organization" on public.organizations;
drop policy if exists "demo visitors read synthetic patients" on public.patients;
drop policy if exists "demo visitors create synthetic patients" on public.patients;
drop policy if exists "demo visitors update synthetic patients" on public.patients;
drop policy if exists "demo visitors read appointments" on public.appointments;
drop policy if exists "demo visitors create appointments" on public.appointments;
drop policy if exists "demo visitors update appointments" on public.appointments;

-- Enable RLS everywhere containing tenant or clinical data.
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.encounters enable row level security;
alter table public.queue_events enable row level security;
alter table public.recordings enable row level security;
alter table public.transcripts enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.extraction_runs enable row level security;
alter table public.extracted_clinical_fields enable row level security;
alter table public.field_evidence enable row level security;
alter table public.documentation_suggestions enable row level security;
alter table public.clinical_records enable row level security;
alter table public.clinical_record_fields enable row level security;
alter table public.generated_outputs enable row level security;
alter table public.patient_history enable row level security;
alter table public.patient_allergies enable row level security;
alter table public.symptoms enable row level security;
alter table public.symptom_timeline_events enable row level security;
alter table public.ai_suggested_questions enable row level security;
alter table public.disease_predictions enable row level security;
alter table public.clinical_flags enable row level security;
alter table public.medicines_to_avoid enable row level security;
alter table public.summary_breakdowns enable row level security;
alter table public.audit_events enable row level security;

-- Basic profile and membership policies.
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "members read organizations" on public.organizations;
create policy "members read organizations" on public.organizations for select to authenticated using (public.is_organization_member(id));
drop policy if exists "members read memberships" on public.organization_members;
create policy "members read memberships" on public.organization_members for select to authenticated using (public.is_organization_member(organization_id));

-- Consistent tenant isolation. Writes are allowed to clinical staff; the service
-- role used by FastAPI bypasses RLS and should never be exposed to the browser.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'patients','appointments','encounters','queue_events','recordings','transcripts',
    'transcript_segments','extraction_runs','extracted_clinical_fields','field_evidence',
    'documentation_suggestions','clinical_records','clinical_record_fields',
    'generated_outputs','patient_history','patient_allergies','symptoms',
    'symptom_timeline_events','ai_suggested_questions','disease_predictions',
    'clinical_flags','medicines_to_avoid','summary_breakdowns','audit_events'
  ] loop
    execute format('drop policy if exists "organization members read" on public.%I', table_name);
    execute format('create policy "organization members read" on public.%I for select to authenticated using (public.is_organization_member(organization_id))', table_name);
    execute format('drop policy if exists "clinical staff insert" on public.%I', table_name);
    execute format('create policy "clinical staff insert" on public.%I for insert to authenticated with check (public.has_organization_role(organization_id, array[''admin'',''receptionist'',''nurse'',''doctor'']::public.member_role[]))', table_name);
    execute format('drop policy if exists "clinical staff update" on public.%I', table_name);
    execute format('create policy "clinical staff update" on public.%I for update to authenticated using (public.has_organization_role(organization_id, array[''admin'',''receptionist'',''nurse'',''doctor'']::public.member_role[])) with check (public.has_organization_role(organization_id, array[''admin'',''receptionist'',''nurse'',''doctor'']::public.member_role[]))', table_name);
  end loop;
end $$;

-- Audio storage. Store objects at: <organization_uuid>/<encounter_uuid>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinical-audio','clinical-audio',false,26214400,array['audio/webm','audio/wav','audio/mpeg','audio/mp4','audio/ogg','audio/x-m4a'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "members read clinical audio" on storage.objects;
create policy "members read clinical audio" on storage.objects for select to authenticated
using (bucket_id='clinical-audio' and public.is_organization_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "clinical staff upload audio" on storage.objects;
create policy "clinical staff upload audio" on storage.objects for insert to authenticated
with check (bucket_id='clinical-audio' and public.has_organization_role(((storage.foldername(name))[1])::uuid,array['admin','nurse','doctor']::public.member_role[]));
drop policy if exists "clinical staff delete audio" on storage.objects;
create policy "clinical staff delete audio" on storage.objects for delete to authenticated
using (bucket_id='clinical-audio' and public.has_organization_role(((storage.foldername(name))[1])::uuid,array['admin','nurse','doctor']::public.member_role[]));

commit;
