"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildingOffice2Icon, CheckCircleIcon, ChevronDownIcon, ClipboardDocumentCheckIcon, DocumentArrowDownIcon, SparklesIcon, UserIcon } from "@heroicons/react/24/outline";
import { PatientBanner } from "@/components/patient-banner";
import { SafetyBanner } from "@/components/safety-banner";
import { SectionTitle, Shell } from "@/components/shell";
import { useDemo } from "@/components/workspace-context";
import { downloadWordReport, type ReportAudience } from "@/lib/word-reports";

type Group=ReportAudience;

export default function Outputs(){
  const {patient,record,outputs}=useDemo();
  const [phase,setPhase]=useState(0);
  const [open,setOpen]=useState<Group|null>(null);
  const [generating,setGenerating]=useState<Group|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{if(record?.status==="clinician_verified"){const first=setTimeout(()=>setPhase(1),900),second=setTimeout(()=>setPhase(2),2100);return()=>{clearTimeout(first);clearTimeout(second)}}},[record]);

  if(record?.status!=="clinician_verified")return <Shell title="Specialized outputs" eyebrow="Information translation"><div className="mx-auto max-w-xl space-y-5"><SafetyBanner/><div className="card p-8 text-center"><h2 className="text-xl font-bold">Clinician verification required</h2><p className="mt-3 text-sm leading-6 text-muted">Reports remain locked until a qualified clinician reviews and verifies the AI-generated record.</p><Link href={`/clinical-record/${patient.id||"current"}`} className="btn-primary mt-6">Review clinical record</Link></div></div></Shell>;
  const get=(group:Group,key:string,fallback="Not documented")=>String(outputs?.[group]?.[key]||fallback);
  const download=async(group:Group)=>{setGenerating(group);setError("");try{await downloadWordReport(group,patient,record,outputs)}catch(cause){setError(cause instanceof Error?cause.message:"Could not create Word report")}finally{setGenerating(null)}};

  if(phase<2)return <Shell title="Specialized outputs" eyebrow="Preparing verified reports"><div className="grid min-h-[65vh] place-items-center"><div className="text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal-100 text-teal-700">{phase===0?<CheckCircleIcon className="h-8 w-8"/>:<SparklesIcon className="h-8 w-8 animate-pulse"/>}</span><h2 className="mt-6 text-3xl font-extrabold tracking-tight">{phase===0?"Clinical record verified.":"Preparing information for each audience..."}</h2><p className="mt-3 text-sm text-muted">{phase===0?"The clinician-approved record is now the source of truth.":"Insurance · Pharmacy · Patient"}</p></div></div></Shell>;

  return <Shell title="Specialized outputs" eyebrow="One verified record · three audiences"><div className="space-y-8"><SafetyBanner/><PatientBanner status="Clinician verified"/>
    <div className="text-center"><span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-700"><CheckCircleIcon className="h-4 w-4"/> Clinical record verified</span><h2 className="mt-4 text-3xl font-extrabold tracking-tight">One source of truth. Three Word reports.</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">Download audience-specific documents generated only from the clinician-verified record.</p></div>
    {error&&<p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-3">
      <RevealCard open={open==="insurance"} onOpen={()=>setOpen(open==="insurance"?null:"insurance")} onDownload={()=>download("insurance")} downloading={generating==="insurance"} emoji="🏥" title="Insurance" subtitle="Insurance clinical report"><Item label="Clinical summary" value={get("insurance","clinical_summary")}/><Item label="Documented diagnosis" value={get("insurance","diagnosis")}/><Item label="Procedures" value={get("insurance","procedures")}/><Item label="Clinical justification" value={get("insurance","clinical_justification")}/><p className="text-[10px] text-muted">No billing codes, coverage decisions, or unsupported claims are generated.</p></RevealCard>
      <RevealCard open={open==="pharmacy"} onOpen={()=>setOpen(open==="pharmacy"?null:"pharmacy")} onDownload={()=>download("pharmacy")} downloading={generating==="pharmacy"} emoji="💊" title="Pharmacy" subtitle="Pharmacist medication report"><Item label="Clinician-documented medication" value={get("pharmacy","medication")}/><Item label="Dosage / frequency / duration" value={`${get("pharmacy","dosage")} · ${get("pharmacy","frequency")} · ${get("pharmacy","duration")}`}/><Item label="Instructions" value={get("pharmacy","instructions")}/><Item label="Documented allergies" value={get("pharmacy","allergies")}/><p className="text-[10px] text-muted">The report never invents or independently recommends medication.</p></RevealCard>
      <RevealCard open={open==="patient"} onOpen={()=>setOpen(open==="patient"?null:"patient")} onDownload={()=>download("patient")} downloading={generating==="patient"} emoji="👤" title="Patient" subtitle="Plain-language patient report"><Item label="How the patient feels" value={get("patient","what_happened")}/><Item label="What the clinician documented" value={get("patient","clinician_documented")}/><Item label="Medication instructions" value={get("patient","medication_instructions")}/><Item label="Follow-up and warnings" value={get("patient","follow_up")}/><p className="text-[10px] text-muted">Sick leave is included only when mentioned in the verified record.</p></RevealCard>
    </div>
    <Comparison get={get}/>
    <div className="text-center"><Link href={`/patient/${patient.id||"current"}`} className="btn-secondary">Open patient-friendly portal</Link></div>
  </div></Shell>;
}

function RevealCard({open,onOpen,onDownload,downloading,emoji,title,subtitle,children}:{open:boolean;onOpen:()=>void;onDownload:()=>void;downloading:boolean;emoji:string;title:string;subtitle:string;children:React.ReactNode}){return <article className={`card overflow-hidden transition-all duration-500 ${open?"ring-2 ring-teal-500 shadow-xl":"hover:-translate-y-1"}`}><button onClick={onOpen} className="w-full p-6 text-left"><div className="flex items-start justify-between"><span className="text-3xl" aria-hidden>{emoji}</span><ChevronDownIcon className={`h-5 w-5 transition ${open?"rotate-180":""}`}/></div><p className="mt-6 text-[10px] font-bold uppercase tracking-[.18em] text-teal-600">{title}</p><h3 className="mt-1 text-lg font-bold">{subtitle}</h3><p className="mt-3 text-xs text-muted">{open?"Hide details":"Expand to preview"}</p></button><div className={`grid transition-all duration-500 ${open?"grid-rows-[1fr] border-t border-line":"grid-rows-[0fr]"}`}><div className="overflow-hidden"><div className="space-y-4 p-6">{children}</div></div></div><div className="border-t border-line p-4"><button onClick={onDownload} disabled={downloading} className="btn-primary w-full disabled:opacity-50"><DocumentArrowDownIcon className="h-4 w-4"/>{downloading?"Creating Word report…":"Download Word report"}</button></div></article>}
function Item({label,value}:{label:string;value:string}){return <div><p className="label">{label}</p><p className="text-xs leading-5 text-slate-600">{value}</p></div>}
function Comparison({get}:{get:(group:Group,key:string,fallback?:string)=>string}){return <section className="overflow-hidden rounded-3xl border border-line bg-white shadow-card"><div className="border-b border-line p-7 text-center"><SectionTitle eyebrow="Report comparison" title="The same verified facts shaped for each reader" description="Content changes structure and language, not clinical meaning."/></div><div className="grid gap-4 p-6 md:grid-cols-3"><Compare label="Insurance" icon={<BuildingOffice2Icon className="h-5 w-5"/>} text={get("insurance","clinical_summary")}/><Compare label="Pharmacy" icon={<ClipboardDocumentCheckIcon className="h-5 w-5"/>} text={`${get("pharmacy","medication")}. Allergy: ${get("pharmacy","allergies")}.`}/><Compare label="Patient" icon={<UserIcon className="h-5 w-5"/>} text={`${get("patient","what_happened")} ${get("patient","clinician_documented")}.`}/></div></section>}
function Compare({label,icon,text}:{label:string;icon:React.ReactNode;text:string}){return <div className="rounded-2xl border border-line bg-canvas p-5"><span className="text-teal-700">{icon}</span><p className="mt-4 text-[10px] font-bold uppercase tracking-[.15em] text-teal-700">{label}</p><p className="mt-2 text-xs leading-6 text-slate-600">{text}</p></div>}
