"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ExclamationTriangleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import type { RedFlagAlert, Segment } from "@/lib/ai-types";
import { detectRedFlags } from "@/lib/api";

const transcriptKey=(segments:Segment[])=>segments.map(segment=>`${segment.speaker}:${segment.text}`).join("\n");

export function RedFlagAlerts({segments,live}:{segments:Segment[];live:boolean}){
  const [alerts,setAlerts]=useState<RedFlagAlert[]>([]);
  const [acknowledged,setAcknowledged]=useState<Set<string>>(new Set());
  const [scanning,setScanning]=useState(false);
  const [scannedLines,setScannedLines]=useState<number|null>(null);
  const [error,setError]=useState("");
  const lastKey=useRef("");
  const latestSegments=useRef(segments);
  latestSegments.current=segments;
  const key=transcriptKey(segments);

  useEffect(()=>{
    if(!key.trim()||key===lastKey.current)return;
    let cancelled=false;
    const timer=setTimeout(async()=>{
      lastKey.current=key;setScanning(true);setError("");
      try{const current=latestSegments.current;const {alerts:next}=await detectRedFlags(current);if(!cancelled){setAlerts(next);setScannedLines(current.length)}}
      catch(cause){if(!cancelled)setError(cause instanceof Error?cause.message:"Safety scan failed")}
      finally{if(!cancelled)setScanning(false)}
    },live?3000:300);
    return()=>{cancelled=true;clearTimeout(timer)};
  },[key,live]);

  const active=alerts.filter(alert=>!acknowledged.has(alert.condition));
  const reviewed=alerts.filter(alert=>acknowledged.has(alert.condition));
  if(!segments.length)return null;
  if(!active.length)return <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-xs text-muted"><ShieldCheckIcon className={`h-4 w-4 ${scanning?"animate-pulse text-amber-600":"text-emerald-600"}`}/>{scanning?"Red-flag safety scan running…":error?`Red-flag safety scan unavailable: ${error}`:scannedLines!==null?`No red-flag patterns detected in ${scannedLines} transcript line${scannedLines===1?"":"s"}${live?" so far":""}.`:"Red-flag safety scan pending…"}{reviewed.length>0&&<span className="ml-auto font-bold text-slate-500">{reviewed.length} acknowledged</span>}</div>;

  return <section className="overflow-hidden rounded-2xl border-2 border-red-300 bg-red-50 shadow-lg" role="alert">
    <div className="flex items-center gap-3 border-b border-red-200 bg-red-600 px-5 py-3 text-white"><ExclamationTriangleIcon className="h-5 w-5 animate-pulse"/><p className="text-sm font-extrabold uppercase tracking-wider">Red-flag pattern detected · clinician review now</p>{scanning&&<span className="ml-auto text-[10px] font-bold uppercase text-red-100">Updating…</span>}</div>
    <div className="space-y-3 p-5">{active.map(alert=><article key={alert.condition} className="rounded-xl border border-red-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-extrabold text-red-900">{alert.condition}</h3><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${alert.urgency==="emergency"?"bg-red-600 text-white":"bg-amber-100 text-amber-800"}`}>{alert.urgency}</span><button onClick={()=>setAcknowledged(new Set(acknowledged).add(alert.condition))} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-[10px] font-bold text-red-800 hover:bg-red-50"><CheckIcon className="h-3.5 w-3.5"/> Acknowledge</button></div>
      <p className="mt-2 text-xs leading-5 text-slate-700">{alert.rationale}</p>
      <div className="mt-3 flex flex-wrap gap-2">{alert.triggers.map(trigger=><q key={trigger} className="rounded-md bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-900">{trigger}</q>)}</div>
      <p className="mt-3 text-xs text-slate-600"><b className="text-slate-800">Check:</b> {alert.clinician_check}</p>
    </article>)}
    <p className="text-[10px] leading-4 text-red-900/70">Decision support only, based on quotes from this transcript. It is not a diagnosis; the clinician decides what to do.</p></div>
  </section>;
}
