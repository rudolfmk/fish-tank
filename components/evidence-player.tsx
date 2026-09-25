"use client";

import { useEffect, useRef, useState } from "react";
import { PlayIcon, StopIcon } from "@heroicons/react/24/solid";
import type { Segment } from "@/lib/ai-types";
import { loadAudio } from "@/lib/audio-store";
import { useDemo } from "./workspace-context";

type Role="nurse"|"doctor";
type Clip={role:Role;start:number|null;end:number|null;share:[number,number]};

const normalize=(text:string)=>text.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const words=(text:string)=>new Set(normalize(text).split(" ").filter(Boolean));

function findClip(quote:string,sources:[Role,Segment[]][]):Clip|null{
  const target=normalize(quote);if(!target)return null;
  let best:{clip:Clip;score:number}|null=null;
  for(const [role,segments] of sources){
    const total=segments.reduce((sum,segment)=>sum+segment.text.length,0)||1;let offset=0;
    for(const [index,segment] of segments.entries()){
      const text=normalize(segment.text);
      const quoteWords=words(quote);const overlap=[...quoteWords].filter(word=>words(segment.text).has(word)).length/(quoteWords.size||1);
      const score=text.includes(target)?2:target.includes(text)&&text.length>8?1.5:overlap;
      const next=segments[index+1]?.start;
      const clip:Clip={role,start:segment.start??null,end:segment.end??(next!=null?next:segment.start!=null?segment.start+8:null),share:[offset/total,(offset+segment.text.length)/total]};
      if(score>=0.6&&(!best||score>best.score))best={clip,score};
      offset+=segment.text.length;
    }
  }
  return best?.clip||null;
}

let current:{audio:HTMLAudioElement;url:string;stop:()=>void}|null=null;
function stopCurrent(){if(current){current.audio.pause();URL.revokeObjectURL(current.url);current.stop();current=null}}

async function duration(audio:HTMLAudioElement){
  await new Promise(resolve=>{if(audio.readyState>=1)resolve(null);else audio.addEventListener("loadedmetadata",()=>resolve(null),{once:true})});
  if(Number.isFinite(audio.duration))return audio.duration;
  audio.currentTime=1e9;
  await new Promise(resolve=>audio.addEventListener("durationchange",()=>resolve(null),{once:true}));
  const value=audio.duration;audio.currentTime=0;return Number.isFinite(value)?value:null;
}

export function PlayEvidence({quote,label,className=""}:{quote:string;label?:string;className?:string}){
  const {nurseResult,doctorResult}=useDemo();
  const [playing,setPlaying]=useState(false);
  const [error,setError]=useState("");
  const mine=useRef<HTMLAudioElement|null>(null);
  useEffect(()=>()=>{if(current&&current.audio===mine.current)stopCurrent()},[]);
  const clip=findClip(quote,[["nurse",nurseResult?.segments||[]],["doctor",doctorResult?.segments||[]]]);

  const play=async(event:React.SyntheticEvent)=>{
    event.stopPropagation();event.preventDefault();
    if(playing){stopCurrent();return}
    stopCurrent();setError("");
    if(!clip){setError("Quote not found in transcript");return}
    const blob=await loadAudio(clip.role).catch(()=>undefined);
    if(!blob){setError(`No ${clip.role} audio saved in this browser`);return}
    const url=URL.createObjectURL(blob);const audio=new Audio(url);mine.current=audio;
    current={audio,url,stop:()=>setPlaying(false)};setPlaying(true);
    try{
      let start=clip.start,end=clip.end;
      if(start==null){const length=await duration(audio);if(length==null)throw new Error("No timestamp for this quote");start=clip.share[0]*length;end=clip.share[1]*length}
      start=Math.max(0,start-0.4);end=(end??start+8)+0.4;
      audio.currentTime=start;
      audio.ontimeupdate=()=>{if(audio.currentTime>=end!)stopCurrent()};
      audio.onended=stopCurrent;
      await audio.play();
    }catch(cause){stopCurrent();setError(cause instanceof Error?cause.message:"Playback failed")}
  };

  return <span role="button" tabIndex={0} onClick={play} onKeyDown={event=>{if(event.key==="Enter"||event.key===" ")play(event)}} title={error||(clip?`Play the ${clip.role} recording where this was said`:"Quote not found in transcript")} className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${playing?"bg-teal-700 text-white":error?"bg-red-50 text-red-700":"bg-teal-50 text-teal-700 hover:bg-teal-100"} ${className}`}>{playing?<StopIcon className="h-3 w-3 animate-pulse"/>:<PlayIcon className="h-3 w-3"/>}{error?"Unavailable":playing?"Playing":label||"Hear it"}</span>;
}
