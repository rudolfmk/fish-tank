"use client";

import { useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { AudioRecorder } from "@/components/audio-recorder";
import { AIExtraction } from "@/components/ai-extraction";
import { AssistantPanel } from "@/components/assistant-panel";
import { PatientBanner } from "@/components/patient-banner";
import { RedFlagAlerts } from "@/components/red-flag-alerts";
import { SafetyBanner } from "@/components/safety-banner";
import { NextLink, SectionTitle, Shell, Status } from "@/components/shell";
import { Transcript } from "@/components/transcript";
import { useDemo } from "@/components/workspace-context";

export default function Nurse(){
  const {patient,nurseResult,setResult,resetStage}=useDemo();
  const [live,setLive]=useState<{speaker:string;text:string;start?:number|null}[]>([]);
  const [liveActive,setLiveActive]=useState(false);
  const saved=nurseResult?.segments.map(segment=>({speaker:segment.speaker,time:segment.start!=null?formatTime(segment.start):"",text:segment.text}))||[];
  const items=liveActive?live.map(segment=>({speaker:segment.speaker,time:segment.start!=null?formatTime(segment.start):"Live",text:segment.text})):saved;

  const reset=()=>{if(window.confirm("Reset the nurse session? This will remove the nurse recording and all downstream doctor and report data.")){resetStage("nurse");setLive([]);setLiveActive(false)}};
  return <Shell title="Nurse workspace" eyebrow="Clinical intake" actions={<div className="flex flex-wrap gap-3"><button onClick={reset} className="btn-secondary text-red-700"><ArrowPathIcon className="h-4 w-4"/> Reset nurse session</button><NextLink href="/doctor">Send to Doctor</NextLink></div>}><div className="flex flex-col gap-6"><SafetyBanner/><PatientBanner status="Nurse intake"/><RedFlagAlerts segments={liveActive?live:nurseResult?.segments||[]} live={liveActive}/><div className="grid gap-6 xl:grid-cols-[1fr_380px]"><div className="space-y-6">
    <div className="card p-6"><div className="flex flex-wrap items-start justify-between gap-4"><SectionTitle eyebrow="Reception handoff" title="Visit information" description="Information entered during patient intake."/><Status tone="blue">Captured at reception</Status></div><div className="mt-6 grid gap-5 sm:grid-cols-3"><Info label="Reason for visit" value={patient.reason}/><Info label="Appointment" value={patient.appointment?new Date(patient.appointment).toLocaleString():"Not entered"}/><Info label="Insurance" value={patient.insurance}/></div></div>
    <AudioRecorder role="nurse" onComplete={result=>{setLiveActive(false);setResult("nurse",result)}} onLive={(segments,active)=>{setLive(segments);setLiveActive(active)}}/>
    <div className={`card p-6 transition ${liveActive?"ring-2 ring-red-200":""}`}><div className="mb-6 flex items-center justify-between"><SectionTitle eyebrow="Live transcript" title="Nurse intake conversation" description="The text below comes from this recording and remains after it is saved."/>{liveActive?<Status tone="amber">Listening live</Status>:nurseResult?<Status>Saved transcript</Status>:<Status tone="slate">No recording yet</Status>}</div>{items.length?<Transcript items={items}/>:<EmptyTranscript/>}</div>
    {nurseResult&&<AIExtraction data={nurseResult.extraction}/>}</div>
    <aside className="space-y-6"><AssistantPanel suggestions={nurseResult?.suggestions} liveSegments={live} resolvedFields={nurseResult?Object.entries(nurseResult.extraction).filter(([,field])=>Boolean(field.value)).map(([key])=>key):[]}/><div className="card p-5"><SectionTitle title="Extracted intake notes" description="Generated only from the saved transcript."/><div className="mt-4 space-y-3"><Note label="Temperature" value={nurseResult?.extraction.temperature?.value}/><Note label="Blood pressure" value={nurseResult?.extraction.blood_pressure?.value}/><Note label="Heart rate" value={nurseResult?.extraction.heart_rate?.value}/><Note label="Respiratory rate" value={nurseResult?.extraction.respiratory_rate?.value}/><Note label="Oxygen saturation" value={nurseResult?.extraction.oxygen_saturation?.value}/><Note label="Weight" value={nurseResult?.extraction.weight?.value}/><Note label="Symptoms" value={nurseResult?.extraction.symptoms?.value}/><Note label="Medication" value={nurseResult?.extraction.current_medications?.value}/><Note label="Allergy" value={nurseResult?.extraction.allergies?.value}/><Note label="Important notes" value={nurseResult?.extraction.important_notes?.value}/></div></div></aside>
  </div></div></Shell>;
}

function formatTime(seconds:number){return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,"0")}`}
function EmptyTranscript(){return <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-line bg-canvas text-center"><div><p className="text-sm font-bold">No transcript captured</p><p className="mt-1 text-xs text-muted">Start recording and speak to create the transcript.</p></div></div>}
function Info({label,value}:{label:string;value?:string}){return <div><p className="label">{label}</p><p className="text-sm font-semibold">{value||"Not entered"}</p></div>}
function Note({label,value}:{label:string;value?:string|null}){return <div className="rounded-xl bg-canvas p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p><p className="mt-1 text-xs font-semibold">{value||"Not documented"}</p></div>}
