"use client";

import { ChangeEvent, useRef, useState } from "react";
import { ArrowUpTrayIcon, ExclamationCircleIcon, MicrophoneIcon, StopIcon } from "@heroicons/react/24/solid";
import { analyzeTranscript, transcribeAudio } from "@/lib/api";
import type { AIResult, EvidenceField, Segment } from "@/lib/ai-types";
import { explicitlyStatedRole } from "@/lib/speaker-attribution";

type SpeechResultEvent={resultIndex:number;results:ArrayLike<{isFinal:boolean;0:{transcript:string}}>};
type SpeechRecognitionLike={continuous:boolean;interimResults:boolean;lang:string;start:()=>void;stop:()=>void;onresult:((e:SpeechResultEvent)=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null};
declare global { interface Window { SpeechRecognition?:new()=>SpeechRecognitionLike;webkitSpeechRecognition?:new()=>SpeechRecognitionLike } }

const fieldNames=["chief_complaint","symptoms","duration","severity","temperature","blood_pressure","heart_rate","respiratory_rate","oxygen_saturation","weight","medical_history","current_medications","allergies","important_notes","examination_findings","diagnosis","treatment","follow_up_instructions"];
const blankExtraction=()=>Object.fromEntries(fieldNames.map(key=>[key,{value:null,evidence:[],source:"unknown"} satisfies EvidenceField]));

export function AudioRecorder({role,onComplete,onLive}:{role:"nurse"|"doctor";onComplete:(r:AIResult)=>void;onLive?:(segments:Segment[],active:boolean,supported:boolean)=>void}){
  const recorder=useRef<MediaRecorder|null>(null);
  const recognition=useRef<SpeechRecognitionLike|null>(null);
  const chunks=useRef<Blob[]>([]);
  const liveLines=useRef<Segment[]>([]);
  const pendingLine=useRef<Segment|null>(null);
  const startedAt=useRef(0);
  const defaultSpeaker=role==="nurse"?"Nurse":"Doctor";
  const activeSpeakerRef=useRef(defaultSpeaker);
  const [activeSpeaker,setActiveSpeaker]=useState(defaultSpeaker);
  const [state,setState]=useState<"idle"|"recording"|"processing">("idle");
  const [error,setError]=useState("");
  const [liveSupported,setLiveSupported]=useState<boolean|null>(null);

  const preserveBrowserTranscript=async(segments:Segment[])=>{
    if(!segments.length)throw new Error("No speech was captured. Please record again or upload audio for server transcription.");
    try{
      const analysis=await analyzeTranscript(segments,role);
      onComplete({segments,...analysis,demo:false});
    }catch(e){
      onComplete({segments,extraction:blankExtraction(),suggestions:[],flags:[],symptom_timeline:[],demo:false});
      throw new Error(`${e instanceof Error?e.message:"AI analysis failed"} Your actual transcript was still saved.`);
    }
  };

  const process=async(blob:Blob,name?:string,browserSegments:Segment[]=[] )=>{
    setState("processing");setError("");
    try{onComplete(await transcribeAudio(blob,role,name))}
    catch(serverError){
      try{await preserveBrowserTranscript(browserSegments)}
      catch(fallbackError){const serverMessage=serverError instanceof Error?`Server transcription failed: ${serverError.message}. `:"";setError(serverMessage+(fallbackError instanceof Error?fallbackError.message:"Audio processing failed."))}
    }finally{setState("idle")}
  };

  const startLive=()=>{
    const Ctor=window.SpeechRecognition||window.webkitSpeechRecognition;
    liveLines.current=[];pendingLine.current=null;startedAt.current=performance.now();
    if(!Ctor){setLiveSupported(false);onLive?.([],true,false);return}
    setLiveSupported(true);
    const sr=new Ctor();recognition.current=sr;sr.continuous=true;sr.interimResults=true;sr.lang="en-US";
    sr.onresult=e=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const spoken=e.results[i][0].transcript.trim();if(e.results[i].isFinal&&spoken){const start=(performance.now()-startedAt.current)/1000;liveLines.current.push({speaker:explicitlyStatedRole(spoken)||activeSpeakerRef.current,text:spoken,start})}else if(!e.results[i].isFinal)interim+=`${interim?" ":""}${spoken}`}pendingLine.current=interim?{speaker:explicitlyStatedRole(interim)||activeSpeakerRef.current,text:interim,start:(performance.now()-startedAt.current)/1000}:null;const lines=pendingLine.current?[...liveLines.current,pendingLine.current]:[...liveLines.current];onLive?.(lines,true,true)};
    sr.onerror=e=>{if(e.error!=="no-speech")setError("Live captions paused. Recorded audio will still be sent for transcription.")};
    sr.onend=()=>{if(recorder.current?.state==="recording"){try{sr.start()}catch{}}};
    try{sr.start()}catch{setLiveSupported(false)}
  };

  const start=async()=>{setError("");activeSpeakerRef.current=defaultSpeaker;setActiveSpeaker(defaultSpeaker);try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const r=new MediaRecorder(stream);recorder.current=r;chunks.current=[];r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};r.onstop=()=>{recognition.current?.stop();const captured=pendingLine.current?[...liveLines.current,pendingLine.current]:[...liveLines.current];pendingLine.current=null;onLive?.(captured,false,Boolean(window.SpeechRecognition||window.webkitSpeechRecognition));stream.getTracks().forEach(t=>t.stop());process(new Blob(chunks.current,{type:r.mimeType}),"recording.webm",captured)};r.start(1000);setState("recording");startLive()}catch{setError("Microphone access was unavailable. You can upload an audio file instead.")}};
  const upload=(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(f)process(f,f.name);e.target.value=""};

  const chooseSpeaker=(speaker:string)=>{activeSpeakerRef.current=speaker;setActiveSpeaker(speaker)};
  return <div className="space-y-3">{state==="recording"&&<div className="card p-3"><p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted">Who is speaking now?</p><div className="grid grid-cols-2 gap-2">{[defaultSpeaker,"Patient"].map(speaker=><button type="button" key={speaker} onClick={()=>chooseSpeaker(speaker)} className={`rounded-xl px-4 py-3 text-sm font-bold transition ${activeSpeaker===speaker?"bg-teal-700 text-white shadow-sm":"bg-slate-100 text-slate-600 hover:bg-teal-50"}`}>{speaker}</button>)}</div></div>}<div className={`rounded-2xl p-1 ${state==="recording"?"bg-red-50 ring-2 ring-red-200":"bg-[#123F3B]"}`}><button disabled={state==="processing"} onClick={state==="recording"?()=>recorder.current?.stop():start} className={`group flex w-full items-center justify-center gap-3 rounded-xl px-6 py-5 text-sm font-bold transition ${state==="recording"?"bg-red-600 text-white":"text-white hover:bg-white/10"}`}><span className="grid h-10 w-10 place-items-center rounded-full bg-white/15">{state==="recording"?<StopIcon className="h-5 w-5"/>:<MicrophoneIcon className={`h-5 w-5 ${state==="processing"?"animate-pulse":""}`}/>}</span>{state==="recording"?"Stop & Save":state==="processing"?"Saving transcript…":"Start Recording"}{state==="recording"&&<span className="h-2 w-2 animate-pulse rounded-full bg-white"/>}</button></div>{state==="recording"&&<div className="flex items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500"/>{liveSupported===false?"Recording · live captions unavailable":`Live transcript · ${activeSpeaker} speaking`}</div>}<label className="btn-secondary w-full cursor-pointer"><ArrowUpTrayIcon className="h-4 w-4"/> Upload audio<input type="file" accept="audio/*,.webm,.m4a,.mp3,.wav,.ogg" className="sr-only" onChange={upload} disabled={state!=="idle"}/></label>{error&&<p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700"><ExclamationCircleIcon className="h-4 w-4 shrink-0"/>{error}</p>}<p className="text-center text-[10px] text-muted">Choose the speaker before they talk. Every saved line keeps that speaker label.</p></div>;
}
