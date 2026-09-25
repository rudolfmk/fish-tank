"use client";

import { useEffect, useRef, useState } from "react";
import { PlayIcon, StopIcon } from "@heroicons/react/24/solid";
import type { Segment } from "@/lib/ai-types";
import { loadAudio } from "@/lib/audio-store";
import { useDemo } from "./workspace-context";

type Role="nurse"|"doctor";
type Match={role:Role;fractionStart:number;fractionEnd:number;stampStart:number|null;stampEnd:number|null;stampSpan:number|null;score:number};

const normalize=(text:string)=>text.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const wordsOf=(text:string)=>normalize(text).split(" ").filter(Boolean);

// Model timestamps are frequently wrong (often compressed into a fraction of the real
// recording), so a quote is located by where its text sits within the role's transcript
// and timestamps are used only when they agree with both the recording length and that position.
function locate(quote:string,role:Role,segments:Segment[]):Match|null{
  const target=normalize(quote);
  if(!target||!segments.length)return null;
  const texts=segments.map(segment=>normalize(segment.text));
  const starts:number[]=[];
  let cursor=0;
  for(const text of texts){starts.push(cursor);cursor+=text.length+1}
  const full=texts.join(" ");
  if(!full.length)return null;

  let charStart=full.indexOf(target);
  let charEnd=charStart+target.length;
  let score=charStart>=0?1:0;
  if(charStart<0){
    const targetWords=new Set(wordsOf(quote));
    let best=-1;
    texts.forEach((text,index)=>{
      const segmentWords=new Set(wordsOf(text));
      const shared=[...targetWords].filter(word=>segmentWords.has(word)).length;
      const overlap=shared/Math.max(targetWords.size,1);
      if(overlap>score||(overlap===score&&best<0)){if(overlap>=0.4){score=overlap;best=index}}
    });
    if(best<0)return null;
    charStart=starts[best];charEnd=charStart+texts[best].length;
  }

  // Widen to whole segments so the clip always contains the sentence that was spoken.
  const covering=segments.map((_,index)=>index).filter(index=>starts[index]<charEnd&&starts[index]+texts[index].length>charStart);
  if(!covering.length)return null;
  charStart=starts[covering[0]];
  charEnd=starts[covering[covering.length-1]]+texts[covering[covering.length-1]].length;

  const covered=covering.map(index=>segments[index]);
  const stampStart=covered.find(segment=>segment.start!=null)?.start??null;
  const stampEnd=[...covered].reverse().find(segment=>segment.end!=null)?.end??null;
  const stampSpan=segments.reduce<number|null>((longest,segment)=>segment.end!=null&&(longest==null||segment.end>longest)?segment.end:longest,null);
  return {role,fractionStart:charStart/full.length,fractionEnd:charEnd/full.length,stampStart,stampEnd,stampSpan,score};
}

function clipWindow(match:Match,length:number){
  const estimateStart=match.fractionStart*length;
  const estimateEnd=Math.max(match.fractionEnd*length,estimateStart+2);
  const tolerance=Math.max(3,length*0.12);
  const spansRecording=match.stampSpan!=null&&Math.abs(match.stampSpan-length)<=Math.max(2,length*0.1);
  const trusted=spansRecording&&match.stampStart!=null&&Math.abs(match.stampStart-estimateStart)<=tolerance;
  const start=trusted?match.stampStart!:estimateStart;
  const end=trusted&&match.stampEnd!=null&&match.stampEnd>start?match.stampEnd:estimateEnd;
  return {start:Math.max(0,start-0.6),end:Math.min(length,Math.max(end,start+3)+0.6)};
}

let current:{audio:HTMLAudioElement;url:string;stop:()=>void}|null=null;
function stopCurrent(){if(current){current.audio.pause();URL.revokeObjectURL(current.url);current.stop();current=null}}

async function audioLength(audio:HTMLAudioElement){
  await new Promise(resolve=>{if(audio.readyState>=1)resolve(null);else audio.addEventListener("loadedmetadata",()=>resolve(null),{once:true})});
  if(Number.isFinite(audio.duration)&&audio.duration>0)return audio.duration;
  audio.currentTime=1e9;
  await new Promise(resolve=>audio.addEventListener("durationchange",()=>resolve(null),{once:true}));
  const value=audio.duration;
  audio.currentTime=0;
  return Number.isFinite(value)&&value>0?value:null;
}

export function PlayEvidence({quote,label,className=""}:{quote:string;label?:string;className?:string}){
  const {nurseResult,doctorResult}=useDemo();
  const [playing,setPlaying]=useState(false);
  const [error,setError]=useState("");
  const mine=useRef<HTMLAudioElement|null>(null);
  useEffect(()=>()=>{if(current&&current.audio===mine.current)stopCurrent()},[]);

  const candidates=[locate(quote,"nurse",nurseResult?.segments||[]),locate(quote,"doctor",doctorResult?.segments||[])].filter(Boolean) as Match[];
  const match=candidates.sort((a,b)=>b.score-a.score)[0]||null;

  const play=async(event:React.SyntheticEvent)=>{
    event.stopPropagation();event.preventDefault();
    if(playing){stopCurrent();return}
    stopCurrent();setError("");
    if(!match){setError("Quote not found in transcript");return}
    const blob=await loadAudio(match.role).catch(()=>undefined);
    if(!blob){setError(`No ${match.role} audio saved in this browser`);return}
    const url=URL.createObjectURL(blob);
    const audio=new Audio(url);
    mine.current=audio;
    current={audio,url,stop:()=>setPlaying(false)};
    setPlaying(true);
    try{
      const length=await audioLength(audio);
      if(length==null)throw new Error("Audio length unavailable");
      const {start,end}=clipWindow(match,length);
      audio.currentTime=start;
      audio.ontimeupdate=()=>{if(audio.currentTime>=end)stopCurrent()};
      audio.onended=stopCurrent;
      await audio.play();
    }catch(cause){stopCurrent();setError(cause instanceof Error?cause.message:"Playback failed")}
  };

  return <span role="button" tabIndex={0} onClick={play} onKeyDown={event=>{if(event.key==="Enter"||event.key===" ")play(event)}} title={error||(match?`Play the ${match.role} recording where this was said`:"Quote not found in transcript")} className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${playing?"bg-teal-700 text-white":error?"bg-red-50 text-red-700":"bg-teal-50 text-teal-700 hover:bg-teal-100"} ${className}`}>{playing?<StopIcon className="h-3 w-3 animate-pulse"/>:<PlayIcon className="h-3 w-3"/>}{error?"Unavailable":playing?"Playing":label||"Hear it"}</span>;
}
