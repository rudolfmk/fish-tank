"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowPathIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { AIExtraction } from "@/components/ai-extraction";
import { AudioRecorder } from "@/components/audio-recorder";
import { PatientBanner } from "@/components/patient-banner";
import { SafetyBanner } from "@/components/safety-banner";
import { SectionTitle, Shell, Status } from "@/components/shell";
import { Transcript } from "@/components/transcript";
import { useDemo } from "@/components/workspace-context";
import { analyzeTranscript, createRecord } from "@/lib/api";
import type { ClinicalFlag, SymptomTimelineEntry } from "@/lib/ai-types";

export default function Doctor(){
  const router=useRouter();
  const {patient,nurseResult,doctorResult,setResult,resetStage,setRecord}=useDemo();
  const [done,setDone]=useState(false);
  const [error,setError]=useState("");
  const [live,setLive]=useState<{speaker:string;text:string;start?:number|null}[]>([]);
  const [liveActive,setLiveActive]=useState(false);
  const [flagBusy,setFlagBusy]=useState(false);
  const [flagError,setFlagError]=useState("");
  const saved=doctorResult?.segments.map(segment=>({speaker:segment.speaker,time:segment.start!=null?formatTime(segment.start):"",text:segment.text}))||[];
  const items=liveActive?live.map(segment=>({speaker:segment.speaker,time:segment.start!=null?formatTime(segment.start):"Live",text:segment.text})):saved;

  const complete=async()=>{
    if(!nurseResult?.segments.length||!doctorResult?.segments.length){setError("A saved nurse transcript and doctor transcript are required before generating the clinical record.");return}
    setDone(true);setError("");
    try{const generated=await createRecord(patient as unknown as Record<string,unknown>,nurseResult.segments,doctorResult.segments);setRecord(generated);router.push(`/clinical-insights/${patient.id||"current"}`)}
    catch(cause){setError(cause instanceof Error?cause.message:"Could not generate record");setDone(false)}
  };

  const analyzeSeverity=async()=>{
    setFlagBusy(true);setFlagError("");
    try{
      if(nurseResult?.segments.length){const analysis=await analyzeTranscript(nurseResult.segments,"nurse");setResult("nurse",{...nurseResult,...analysis,demo:false})}
      if(doctorResult?.segments.length){const analysis=await analyzeTranscript(doctorResult.segments,"doctor");setResult("doctor",{...doctorResult,...analysis,demo:false})}
    }catch(cause){setFlagError(cause instanceof Error?cause.message:"Severity analysis failed")}
    finally{setFlagBusy(false)}
  };

  const nurseFields=nurseResult?.extraction;
  const fieldValue=(field:string)=>doctorResult?.extraction[field]?.value||nurseResult?.extraction[field]?.value||null;
  const combinedFlags=[...(nurseResult?.flags||[]),...(doctorResult?.flags||[])];
  const fieldFlags=(field:string)=>combinedFlags.filter(flag=>flag.field===field);
  const nurseConversation=nurseResult?.segments.map(segment=>({speaker:segment.speaker,time:segment.start!=null?formatTime(segment.start):"",text:segment.text}))||[];
  const symptomTimeline=dedupeTimeline([...(nurseResult?.symptom_timeline||[]),...(doctorResult?.symptom_timeline||[])]);
  const reset=()=>{if(window.confirm("Reset the doctor session? This will preserve nurse intake but remove the doctor recording and generated reports.")){resetStage("doctor");setLive([]);setLiveActive(false);setDone(false);setError("")}};
  return <Shell title="Doctor workspace" eyebrow="Consultation" actions={<button onClick={reset} className="btn-secondary text-red-700"><ArrowPathIcon className="h-4 w-4"/> Reset doctor session</button>}><div className="space-y-6"><SafetyBanner/><PatientBanner status="Ready for doctor"/><div className="grid gap-6 xl:grid-cols-[1fr_390px]"><div className="space-y-6">
    <div className="card p-6"><SectionTitle eyebrow="Patient overview" title="Nurse handoff" description="This overview contains only patient intake and saved nurse-transcript information."/><div className="mt-6 grid gap-4 md:grid-cols-2"><Overview title="Reason for visit">{patient.reason||"Not entered"}</Overview><Overview title="Nurse symptoms">{nurseFields?.symptoms?.value||"Not documented"}</Overview><Overview title="Allergies">{nurseFields?.allergies?.value||"Not documented"}</Overview><Overview title="Current medication">{nurseFields?.current_medications?.value||"Not documented"}</Overview></div></div>
    <SymptomTimeline entries={symptomTimeline}/>
    <AudioRecorder role="doctor" onComplete={result=>{setLiveActive(false);setResult("doctor",result)}} onLive={(segments,active)=>{setLive(segments);setLiveActive(active)}}/>
    <div className={`card p-6 transition ${liveActive?"ring-2 ring-red-200":""}`}><div className="flex items-center justify-between"><SectionTitle eyebrow="Live transcript" title="Doctor consultation" description="The text below comes from this recording and remains after it is saved."/>{liveActive?<Status tone="amber">Listening live</Status>:doctorResult?<Status>Saved transcript</Status>:<Status tone="slate">No recording yet</Status>}</div><div className="mt-6">{items.length?<Transcript items={items}/>:<EmptyTranscript/>}</div></div>
    {doctorResult&&<AIExtraction data={doctorResult.extraction}/>}</div>
    <aside className="space-y-6"><div className="card overflow-hidden"><div className="border-b border-line bg-gradient-to-r from-teal-50 to-white p-5"><div className="flex items-center justify-between gap-3"><SectionTitle eyebrow="Nurse–patient chat" title="Saved intake conversation" description="Exact conversation captured during nurse intake."/><Status tone={nurseConversation.length?"teal":"slate"}>{nurseConversation.length?"Available":"Not recorded"}</Status></div></div><div className="max-h-[520px] overflow-y-auto p-5">{nurseConversation.length?<Transcript items={nurseConversation}/>:<EmptyTranscript/>}</div></div><div className="card p-5"><SectionTitle title="Clinical information checklist" description="Combined from the saved nurse and doctor transcript extractions, with evidence-backed safety flags."/><div className="mt-5 space-y-2"><Check label="Chief complaint" value={fieldValue("chief_complaint")} flags={fieldFlags("chief_complaint")}/><Check label="Symptoms" value={fieldValue("symptoms")} flags={fieldFlags("symptoms")}/><Check label="Duration" value={fieldValue("duration")} flags={fieldFlags("duration")}/><Check label="Severity" value={fieldValue("severity")} flags={fieldFlags("severity")}/><Check label="Temperature" value={fieldValue("temperature")} flags={fieldFlags("temperature")}/><Check label="Blood pressure" value={fieldValue("blood_pressure")} flags={fieldFlags("blood_pressure")}/><Check label="Heart rate" value={fieldValue("heart_rate")} flags={fieldFlags("heart_rate")}/><Check label="Respiratory rate" value={fieldValue("respiratory_rate")} flags={fieldFlags("respiratory_rate")}/><Check label="Oxygen saturation" value={fieldValue("oxygen_saturation")} flags={fieldFlags("oxygen_saturation")}/><Check label="Weight" value={fieldValue("weight")} flags={fieldFlags("weight")}/><Check label="Medication history" value={fieldValue("current_medications")} flags={fieldFlags("current_medications")}/><Check label="Allergy history" value={fieldValue("allergies")} flags={fieldFlags("allergies")}/><Check label="Important notes" value={fieldValue("important_notes")} flags={fieldFlags("important_notes")}/><Check label="Follow-up plan" value={fieldValue("follow_up_instructions")} flags={fieldFlags("follow_up_instructions")}/></div>{combinedFlags.length===0&&<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-[10px] leading-4 text-amber-900">This saved transcript has not been classified for severity yet.</p><button onClick={analyzeSeverity} disabled={flagBusy||(!nurseResult&&!doctorResult)} className="mt-3 w-full rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{flagBusy?"Analyzing severity…":"Analyze severity flags"}</button>{flagError&&<p className="mt-2 text-[10px] text-red-700">{flagError}</p>}</div>}</div><button onClick={complete} disabled={done||!doctorResult||!nurseResult} className="btn-primary w-full py-4 disabled:cursor-not-allowed disabled:opacity-40">{done?<><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/> Preparing review…</>:"Generate Clinical Record"}</button>{error&&<p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}<p className="text-center text-[10px] leading-4 text-muted">A record can only be generated from saved nurse and doctor transcripts.</p></aside>
  </div></div></Shell>;
}

function formatTime(seconds:number){return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,"0")}`}
function EmptyTranscript(){return <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-line bg-canvas text-center"><div><p className="text-sm font-bold">No transcript captured</p><p className="mt-1 text-xs text-muted">Start recording and speak to create the transcript.</p></div></div>}
function Overview({title,children}:{title:string;children:React.ReactNode}){return <div className="rounded-xl border border-line p-4"><p className="label">{title}</p><p className="text-sm leading-6 text-slate-600">{children}</p></div>}
function dedupeTimeline(entries:SymptomTimelineEntry[]){return entries.filter((entry,index,all)=>all.findIndex(other=>other.day_label.toLowerCase()===entry.day_label.toLowerCase()&&other.description.toLowerCase()===entry.description.toLowerCase())===index)}
function SymptomTimeline({entries}:{entries:SymptomTimelineEntry[]}){return <section className="card overflow-hidden"><div className="flex flex-col justify-between gap-4 border-b border-line bg-gradient-to-r from-teal-50 via-white to-blue-50 p-6 sm:flex-row sm:items-center"><div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-700 text-white shadow-sm"><ClockIcon className="h-5 w-5"/></span><SectionTitle eyebrow="Symptom timeline" title="How symptoms changed over time" description="Built only from chronology explicitly stated in the conversations."/></div><Status tone={entries.length?"teal":"slate"}>{entries.length?`${entries.length} events`:"No timeline yet"}</Status></div>{entries.length?<div className="overflow-x-auto p-6"><div className="relative grid min-w-[680px] auto-cols-fr grid-flow-col gap-4 pt-7"><div className="absolute left-8 right-8 top-[2.15rem] h-1 rounded-full bg-gradient-to-r from-teal-200 via-teal-500 to-blue-300"/>{entries.map((entry,index)=><article key={`${entry.day_label}-${index}`} className="relative pt-8"><span className="absolute left-5 top-0 z-10 grid h-9 w-9 place-items-center rounded-full border-4 border-white bg-teal-700 text-xs font-extrabold text-white shadow-md">{index+1}</span><div className="h-full rounded-2xl border border-line bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-2"><p className="text-xs font-extrabold uppercase tracking-[.14em] text-teal-700">{entry.day_label}</p>{entry.severity&&<span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase text-amber-700">{entry.severity}</span>}</div><p className="mt-3 text-sm font-bold leading-6 text-ink">{entry.description}</p><details className="mt-4"><summary className="cursor-pointer text-[10px] font-bold text-muted">Transcript evidence</summary><p className="mt-2 border-l-2 border-teal-300 pl-3 text-xs italic leading-5 text-slate-500">“{entry.evidence}”</p></details></div></article>)}</div></div>:<div className="grid min-h-44 place-items-center p-6 text-center"><div><ClockIcon className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 text-sm font-bold">No day-by-day history captured</p><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted">Ask the patient what they felt on each day or when symptoms changed. The timeline will appear after the transcript is analyzed.</p></div></div>}</section>}
function Check({label,value,flags}:{label:string;value:string|null;flags:ClinicalFlag[]}){
  const captured=Boolean(value);
  const level:ClinicalFlag["level"]|null=flags.some(flag=>flag.level==="red")?"red":flags.some(flag=>flag.level==="yellow")?"yellow":flags.some(flag=>flag.level==="green")?"green":captured?null:"yellow";
  const tones={green:"bg-emerald-50 text-emerald-700",yellow:"bg-amber-50 text-amber-700",red:"bg-red-50 text-red-700"};
  const tone=level?tones[level]:"bg-slate-100 text-slate-600";
  return <div className="rounded-xl border border-line p-3"><div className="flex items-center gap-3 text-sm"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${tone}`}>{captured&&level!=="red"&&level!=="yellow"?<CheckCircleIcon className="h-4 w-4"/>:<ExclamationTriangleIcon className="h-4 w-4"/>}</span><span className="font-semibold">{label}</span><span className={`ml-auto rounded-full px-2 py-1 text-[9px] font-bold uppercase ${tone}`}>{level?`${level} · ${captured?"Flag":"Missing"}`:"Captured"}</span></div>{value&&<p className="ml-9 mt-2 text-xs leading-5 text-slate-600">{value}</p>}{flags.length>0&&<div className="ml-9 mt-2 flex flex-wrap gap-2">{flags.map((flag,index)=><span key={`${flag.level}-${flag.label}-${index}`} title={flag.evidence?`Evidence: ${flag.evidence}`:undefined} className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase ${tones[flag.level]}`}>{flag.level} · {flag.label}</span>)}</div>}{!captured&&flags.length===0&&<p className="ml-9 mt-2 text-[10px] font-bold uppercase text-amber-700">Yellow · Missing or unclear</p>}</div>
}
