"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BeakerIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  InformationCircleIcon,
  ListBulletIcon,
  QuestionMarkCircleIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { useDemo } from "@/components/workspace-context";
import { PatientBanner } from "@/components/patient-banner";
import { SafetyBanner } from "@/components/safety-banner";
import { SectionTitle, Shell, Status } from "@/components/shell";
import type { EvidenceField } from "@/lib/ai-types";

type Trend = "Not set" | "New" | "Improving" | "Stable" | "Worsening" | "Resolved";

const text = (field?: EvidenceField) => field?.value?.trim() || "";
const splitItems = (value: string) => value.split(/[,;]\s*/).map(item => item.trim()).filter(Boolean);
const hasDocumentedValue = (field?: EvidenceField) => Boolean(field?.value?.trim());

export default function ClinicalInsightsPage() {
  const { patient, record, nurseResult, doctorResult } = useDemo();
  const fields = record?.fields;
  const symptoms = useMemo(() => splitItems(text(fields?.symptoms)), [fields?.symptoms]);
  const storageKey = `clarity-symptom-trends-${patient.id}`;
  const [trends, setTrends] = useState<Record<string, Trend>>({});

  useEffect(() => {
    try { setTrends(JSON.parse(localStorage.getItem(storageKey) || "{}")); } catch { setTrends({}); }
  }, [storageKey]);

  const setTrend = (symptom: string, trend: Trend) => {
    const next = { ...trends, [symptom]: trend };
    setTrends(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  if (!record || !fields) {
    return <Shell title="Clinical insights" eyebrow="Decision support">
      <div className="space-y-6"><SafetyBanner/><PatientBanner status="Consultation in progress"/>
        <EmptyState/>
      </div>
    </Shell>;
  }

  const questions = [...(nurseResult?.suggestions || []), ...(doctorResult?.suggestions || [])]
    .filter((item, index, all) => all.findIndex(other => other.question === item.question) === index);
  const greenFlags = splitItems(text(fields.examination_findings));
  const redFlags = splitItems(text(fields.follow_up_instructions));
  const allergy = text(fields.allergies);
  const diagnosis = text(fields.diagnosis);
  const timeline = [
    { label: "Reported onset", value: text(fields.duration), source: fields.duration?.source },
    { label: "Symptoms documented", value: text(fields.symptoms), source: fields.symptoms?.source },
    { label: "Current impact", value: text(fields.severity), source: fields.severity?.source },
    { label: "Clinical assessment", value: text(fields.examination_findings), source: fields.examination_findings?.source },
  ].filter(item => item.value);

  return <Shell title="Clinical insights" eyebrow="Evidence-aware decision support">
    <div className="space-y-6">
      <SafetyBanner/>
      <PatientBanner status="Insights ready for review"/>

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <SectionTitle eyebrow="Encounter overview" title="Review the whole clinical picture" description="Every insight below is traceable to captured information. Missing information stays visibly missing."/>
        <Status tone="amber">Provisional · clinician review required</Status>
      </div>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <PanelHeading icon={HeartIcon} eyebrow="Symptom tracking" title="Current symptoms" subtitle="Update the trend as the encounter progresses."/>
          {symptoms.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{symptoms.map(symptom =>
            <div key={symptom} className="rounded-2xl border border-line bg-canvas p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{symptom}</p><p className="mt-1 text-xs text-muted">{text(fields.severity) || "Severity not documented"}</p></div><span className="h-2.5 w-2.5 rounded-full bg-teal-500"/></div>
              <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-muted">Trend</label>
              <select aria-label={`${symptom} trend`} className="input mt-1 py-2 text-xs" value={trends[symptom] || "Not set"} onChange={event => setTrend(symptom, event.target.value as Trend)}>
                {["Not set","New","Improving","Stable","Worsening","Resolved"].map(option => <option key={option}>{option}</option>)}
              </select>
            </div>)}
          </div> : <Missing label="No symptoms have been documented."/>}
        </div>

        <div className="card p-6">
          <PanelHeading icon={SparklesIcon} eyebrow="Predicted disease" title="Possible condition"/>
          {diagnosis ? <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">{fields.diagnosis.source === "doctor" ? "Clinician documented" : "AI extracted · unverified"}</p>
            <p className="mt-2 text-lg font-extrabold text-violet-950">{diagnosis}</p>
            <p className="mt-3 text-xs leading-5 text-violet-800">This is not a confirmed diagnosis until the clinical record is reviewed and verified.</p>
          </div> : <Missing label="No condition has been documented or predicted."/>}
        </div>
      </section>

      <section className="card p-6">
        <PanelHeading icon={ClockIcon} eyebrow="Symptom timeline" title="How the encounter developed" subtitle="Chronology assembled only from documented fields."/>
        {timeline.length ? <div className="mt-6 grid gap-0 md:grid-cols-4">{timeline.map((event, index) => <div key={event.label} className="relative border-l-2 border-teal-200 pb-6 pl-6 last:pb-0 md:border-l-0 md:border-t-2 md:pb-0 md:pl-0 md:pt-6">
          <span className="absolute -left-[7px] top-0 h-3 w-3 rounded-full border-2 border-white bg-teal-600 md:-top-[7px] md:left-0"/>
          <div className="md:pr-5"><p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">{event.label}</p><p className="mt-2 text-sm font-semibold leading-6">{event.value}</p><p className="mt-2 text-[10px] capitalize text-muted">Source: {event.source || "unknown"}</p></div>
          {index < timeline.length - 1 && <ChevronRightIcon className="absolute right-2 top-5 hidden h-4 w-4 text-teal-300 md:block"/>}
        </div>)}</div> : <Missing label="There is not enough documented timing information to build a timeline."/>}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <FlagPanel tone="green" title="Green flags" subtitle="Reassuring findings documented during this encounter" items={greenFlags} icon={CheckCircleIcon}/>
        <FlagPanel tone="red" title="Red flags" subtitle="Safety-net symptoms the patient was told to monitor" items={redFlags} icon={ExclamationTriangleIcon}/>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="card p-6">
          <PanelHeading icon={QuestionMarkCircleIcon} eyebrow="AI suggested questions" title="Close documentation gaps"/>
          {questions.length ? <div className="mt-5 space-y-3">{questions.map((question, index) => <div key={`${question.field}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">{question.field.replaceAll("_", " ")}</p><p className="mt-2 text-sm font-semibold leading-6">{question.question}</p></div>)}</div> : <Missing label="No unanswered AI-suggested questions."/>}
        </div>

        <div className="card p-6">
          <PanelHeading icon={ShieldExclamationIcon} eyebrow="Allergy safety" title="Medicines to avoid"/>
          {allergy ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Documented allergy</p><p className="mt-2 text-base font-extrabold text-red-950">{allergy}</p><div className="mt-4 flex gap-2 border-t border-red-200 pt-4"><InformationCircleIcon className="h-5 w-5 shrink-0 text-red-700"/><p className="text-xs leading-5 text-red-900">Avoid medicines containing the documented allergen until a qualified clinician or pharmacist verifies the allergy and medication choice.</p></div></div> : <Missing label="No medicine allergy is documented. This does not mean there are no allergies."/>}
        </div>

        <div className="card p-6">
          <PanelHeading icon={UserIcon} eyebrow="Patient history" title="Known history"/>
          <div className="mt-5 space-y-3"><HistoryRow label="Medical history" field={fields.medical_history}/><HistoryRow label="Current medications" field={fields.current_medications}/><HistoryRow label="Allergies" field={fields.allergies}/></div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line p-6"><PanelHeading icon={ListBulletIcon} eyebrow="Summary breakdown" title="Evidence by clinical section" subtitle="A scannable view of what is known and what remains undocumented."/></div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3">{Object.entries(fields).map(([key, field]) => <div key={key} className="border-b border-r border-line p-5">
          <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted">{key.replaceAll("_", " ")}</p><EvidenceBadge field={field}/></div>
          <p className={`mt-3 text-sm font-semibold leading-6 ${field.value ? "text-ink" : "italic text-muted"}`}>{field.value || "Not documented"}</p>
        </div>)}</div>
      </section>

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl bg-[#103F3C] p-6 text-white sm:flex-row">
        <div><p className="font-bold">Insights reviewed?</p><p className="mt-1 text-xs text-teal-100/70">Continue to confirm each source-backed field in the clinical record.</p></div>
        <Link href={`/clinical-record/${patient.id}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-teal-900">Review clinical record <ChevronRightIcon className="h-4 w-4"/></Link>
      </div>
    </div>
  </Shell>;
}

function EmptyState(){return <div className="card grid min-h-80 place-items-center p-8 text-center"><div><BeakerIcon className="mx-auto h-10 w-10 text-teal-700"/><h2 className="mt-4 text-xl font-bold">No encounter analysis yet</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Complete the doctor consultation first. Insights will be generated from captured encounter information—never placeholder clinical facts.</p><Link href="/doctor" className="btn-primary mt-6">Go to doctor workspace</Link></div></div>}
function PanelHeading({icon:Icon,eyebrow,title,subtitle}:{icon:typeof HeartIcon;eyebrow:string;title:string;subtitle?:string}){return <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5"/></span><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-teal-600">{eyebrow}</p><h2 className="mt-1 font-bold">{title}</h2>{subtitle&&<p className="mt-1 text-xs leading-5 text-muted">{subtitle}</p>}</div></div>}
function Missing({label}:{label:string}){return <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-muted">{label}</div>}
function FlagPanel({tone,title,subtitle,items,icon:Icon}:{tone:"green"|"red";title:string;subtitle:string;items:string[];icon:typeof CheckCircleIcon}){const colors=tone==="green"?"border-emerald-200 bg-emerald-50 text-emerald-900":"border-red-200 bg-red-50 text-red-950";return <div className="card p-6"><PanelHeading icon={Icon} eyebrow={title} title={subtitle}/>{items.length?<div className="mt-5 space-y-2">{items.map(item=><div key={item} className={`flex gap-3 rounded-xl border p-4 ${colors}`}><Icon className="mt-0.5 h-5 w-5 shrink-0"/><p className="text-sm font-semibold leading-5">{item}</p></div>)}</div>:<Missing label={`No ${title.toLowerCase()} are documented.`}/>}</div>}
function HistoryRow({label,field}:{label:string;field?:EvidenceField}){return <div className="rounded-xl border border-line p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold">{label}</p><EvidenceBadge field={field}/></div><p className={`mt-2 text-xs leading-5 ${field?.value?"text-ink":"italic text-muted"}`}>{field?.value||"Not documented"}</p></div>}
function EvidenceBadge({field}:{field?:EvidenceField}){return <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${hasDocumentedValue(field)?"bg-teal-50 text-teal-700":"bg-slate-100 text-slate-500"}`}>{hasDocumentedValue(field)?field?.source:"Missing"}</span>}
