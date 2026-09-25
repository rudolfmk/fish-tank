"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDemo } from "@/components/workspace-context";
import type { PatientSummary } from "@/lib/ai-types";
import { generatePatientSummary } from "@/lib/api";
import { CheckCircleIcon, ChevronLeftIcon, ExclamationTriangleIcon, HeartIcon, LanguageIcon, PhoneIcon, SpeakerWaveIcon, StopIcon } from "@heroicons/react/24/outline";

const languages=[{name:"English",label:"English",code:"en-US"},{name:"Spanish",label:"Español",code:"es-ES"},{name:"Arabic",label:"العربية",code:"ar-SA",rtl:true},{name:"French",label:"Français",code:"fr-FR"},{name:"Hindi",label:"हिन्दी",code:"hi-IN"},{name:"Simplified Chinese",label:"中文",code:"zh-CN"},{name:"Portuguese",label:"Português",code:"pt-BR"},{name:"Tagalog",label:"Tagalog",code:"fil-PH"},{name:"Vietnamese",label:"Tiếng Việt",code:"vi-VN"},{name:"Russian",label:"Русский",code:"ru-RU"},{name:"Urdu",label:"اردو",code:"ur-PK",rtl:true},{name:"German",label:"Deutsch",code:"de-DE"}];
const sections:{key:"what_happened"|"what_clinician_found"|"medicines"|"self_care"|"next_steps";number:string;title:string}[]=[{key:"what_happened",number:"01",title:"What happened today"},{key:"what_clinician_found",number:"02",title:"What your clinician documented"},{key:"medicines",number:"03",title:"Your medicines"},{key:"self_care",number:"04",title:"Taking care of yourself"},{key:"next_steps",number:"05",title:"What happens next"}];
const spoken=(key:keyof PatientSummary)=>key!=="headings";

export default function PatientPage(){
  const {patient,record}=useDemo();
  const [language,setLanguage]=useState(languages[0]);
  const [summaries,setSummaries]=useState<Record<string,PatientSummary>>({});
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [speaking,setSpeaking]=useState<keyof PatientSummary|null>(null);
  const [voiceMissing,setVoiceMissing]=useState(false);
  const [voicesUnavailable,setVoicesUnavailable]=useState(false);
  const recordKey=useRef("");
  const verified=record?.status==="clinician_verified";
  const summary=summaries[language.name];

  useEffect(()=>{const key=JSON.stringify(record?.fields||null);if(key!==recordKey.current){recordKey.current=key;setSummaries({})}},[record]);
  useEffect(()=>{
    if(!verified||!record||summaries[language.name])return;
    let cancelled=false;setLoading(true);setError("");
    generatePatientSummary(record,language.name).then(result=>{if(!cancelled)setSummaries(current=>({...current,[language.name]:result}))}).catch(cause=>{if(!cancelled)setError(cause instanceof Error?cause.message:"Could not create summary")}).finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[verified,record,language,summaries]);
  useEffect(()=>()=>{if(typeof window!=="undefined")window.speechSynthesis?.cancel()},[]);
  useEffect(()=>{window.speechSynthesis?.cancel();setSpeaking(null)},[language]);

  const listen=()=>{
    const synth=window.speechSynthesis;
    if(!synth||!summary)return;
    if(speaking){synth.cancel();setSpeaking(null);return}
    const prefix=language.code.split("-")[0];
    const voices=synth.getVoices();
    if(!voices.length){setVoicesUnavailable(true);return}
    setVoicesUnavailable(false);
    const voice=voices.find(v=>v.lang===language.code)||voices.find(v=>v.lang.toLowerCase().startsWith(prefix));
    setVoiceMissing(!voice);
    const order:(keyof PatientSummary)[]=(["greeting",...sections.map(section=>section.key),"urgent_help"] as (keyof PatientSummary)[]).filter(spoken);
    order.forEach((key,index)=>{const utterance=new SpeechSynthesisUtterance(String(summary[key]));utterance.lang=language.code;if(voice)utterance.voice=voice;utterance.rate=0.95;utterance.onstart=()=>setSpeaking(key);if(index===order.length-1)utterance.onend=()=>setSpeaking(null);utterance.onerror=()=>setSpeaking(null);synth.speak(utterance)});
  };

  const visitDate=patient.appointment?new Date(patient.appointment).toLocaleString(language.code,{dateStyle:"long",timeStyle:"short"}):"";
  const highlight=(key:keyof PatientSummary)=>speaking===key?"ring-2 ring-teal-500 shadow-xl":"";

  return <main className="min-h-screen bg-[#F6FAF9]"><header className="border-b border-line bg-white"><div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 text-xl font-extrabold text-white">+</div><div><p className="font-bold">Clarity Care</p><p className="text-[10px] text-muted">Patient portal</p></div></div><button className="text-xs font-bold text-teal-700">Need help?</button></div></header><div className="mx-auto max-w-5xl px-5 py-10"><Link href={`/outputs/${patient.id||"current"}`} className="mb-7 inline-flex items-center gap-1 text-xs font-semibold text-muted"><ChevronLeftIcon className="h-4 w-4"/> Back to staff view</Link>
    {!verified?<div className="card p-8 text-center"><h2 className="text-xl font-bold">Your summary is not ready yet</h2><p className="mt-3 text-sm leading-6 text-muted">Your clinician needs to review and verify your visit record first.</p><Link href={`/clinical-record/${patient.id||"current"}`} className="btn-primary mt-6">Review clinical record</Link></div>:<>
    <div className="card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="flex items-center gap-2 text-sm font-bold"><LanguageIcon className="h-5 w-5 text-teal-700"/> Your language</div><div className="flex flex-wrap gap-2">{languages.map(option=><button key={option.name} onClick={()=>setLanguage(option)} lang={option.code} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${option.name===language.name?"border-teal-700 bg-teal-700 text-white":"border-line bg-white hover:border-teal-500"}`}>{option.label}</button>)}</div><button onClick={listen} disabled={!summary} className="btn-primary shrink-0 disabled:opacity-40 sm:ml-auto">{speaking?<><StopIcon className="h-4 w-4"/> Stop</>:<><SpeakerWaveIcon className="h-4 w-4"/> Listen</>}</button></div>
    {voicesUnavailable&&<p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">This device has no speech voices installed, so the summary cannot be read aloud here.</p>}{voiceMissing&&<p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">This device has no {language.name} voice installed, so it may read with a different accent.</p>}
    {error&&<p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <div dir={language.rtl?"rtl":"ltr"} lang={language.code} className={loading?"animate-pulse":""}>
    <div className={`rounded-3xl bg-gradient-to-br from-[#123F3B] to-[#1E776F] p-7 text-white transition md:p-10 ${highlight("greeting")}`}><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider"><CheckCircleIcon className="h-3.5 w-3.5"/> Clinician verified</span><h1 className="mt-5 text-3xl font-bold tracking-tight">{summary?.greeting||(loading?`Translating into ${language.name}…`:`Hi, ${patient.name.split(" ")[0]}`)}</h1></div>{visitDate&&<p className="text-xs text-teal-100">{visitDate}</p>}</div></div>
    <div className="mt-6 grid gap-6 md:grid-cols-2">{sections.map(section=><section key={section.key} className={`card p-6 transition ${highlight(section.key)}`}><span className="text-[10px] font-extrabold tracking-wider text-teal-600">{section.number}</span><h2 className="mt-3 text-lg font-bold">{summary?.headings?.[section.key]||section.title}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{summary?.[section.key]||(loading?"…":"")}</p></section>)}</div>
    <div className={`mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 transition ${highlight("urgent_help")}`}><div className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><ExclamationTriangleIcon className="h-5 w-5"/></span><div><h2 className="font-bold text-amber-950">{summary?.headings?.urgent_help||"When to get urgent help"}</h2><p className="mt-2 text-sm leading-6 text-amber-900">{summary?.urgent_help||(loading?"…":"")}</p></div></div></div>
    </div></>}
    <div className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-line bg-white p-6 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><HeartIcon className="h-6 w-6 text-teal-700"/><div><p className="text-sm font-bold">Have questions about your visit?</p><p className="text-xs text-muted">Your care team is here to help.</p></div></div><button className="btn-primary"><PhoneIcon className="h-4 w-4"/> Contact clinic</button></div><p className="mt-8 text-center text-[10px] leading-5 text-muted">This summary is written by AI in your language using only information your clinician reviewed and verified. It does not replace medical advice.</p></div></main>;
}
