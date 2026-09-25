"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowPathIcon, NoSymbolIcon, ShieldExclamationIcon } from "@heroicons/react/24/outline";
import type { AllergyGuidance, Segment } from "@/lib/ai-types";
import { allergyGuidance } from "@/lib/api";
import { SectionTitle, Status } from "./shell";
import { PlayEvidence } from "./evidence-player";

export function AllergyAvoidPanel({segments,allergies,medications}:{segments:Segment[];allergies?:string|null;medications?:string|null}){
  const [guidance,setGuidance]=useState<AllergyGuidance[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const lastKey=useRef("");
  const key=`${allergies||""}|${segments.map(segment=>segment.text).join(" ")}`;

  const load=async()=>{
    lastKey.current=key;setLoading(true);setError("");
    try{const {guidance:next}=await allergyGuidance(segments,allergies,medications);setGuidance(next)}
    catch(cause){setError(cause instanceof Error?cause.message:"Allergy check failed")}
    finally{setLoading(false)}
  };
  useEffect(()=>{if(allergies?.trim()&&key!==lastKey.current)load()},[key,allergies]);

  if(!allergies?.trim())return <div className="card p-5"><SectionTitle eyebrow="Allergy safety" title="Medicines to avoid" description="No allergy is documented yet. This does not mean the patient has none — ask and record the answer."/></div>;

  return <section className="card overflow-hidden">
    <div className="flex items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-red-50 to-white p-5"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><ShieldExclamationIcon className="h-5 w-5"/></span><SectionTitle eyebrow="Allergy safety" title="Medicines to avoid" description="Based only on allergies the patient reported in this conversation."/></div><Status tone={guidance.length?"amber":"slate"}>{loading?"Checking…":guidance.length?`${guidance.length} allergen${guidance.length===1?"":"s"}`:"None found"}</Status></div>
    <div className="space-y-4 p-5">
      {error&&<p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
      {!loading&&!guidance.length&&!error&&<p className="text-xs text-muted">The documented allergy did not produce medicine guidance. Re-run after saving the transcript.</p>}
      {guidance.map(item=><article key={item.allergen} className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-extrabold capitalize text-red-950">{item.allergen}</h3>{item.reaction&&<span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">{item.reaction}</span>}<PlayEvidence quote={item.evidence} label="Hear it" className="ml-auto"/></div>
        <blockquote className="mt-2 border-l-2 border-red-300 pl-3 text-xs italic leading-5 text-red-900">“{item.evidence}”</blockquote>
        <div className="mt-4 space-y-2">{item.avoid.map(medicine=><div key={medicine.medicine} className="flex gap-3 rounded-xl border border-line bg-white p-3">
          <NoSymbolIcon className={`mt-0.5 h-4 w-4 shrink-0 ${medicine.risk==="avoid"?"text-red-600":"text-amber-600"}`}/>
          <div className="min-w-0"><p className="flex flex-wrap items-center gap-2 text-sm font-bold capitalize">{medicine.medicine}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600">{medicine.drug_class}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${medicine.risk==="avoid"?"bg-red-100 text-red-700":"bg-amber-100 text-amber-800"}`}>{medicine.risk}</span></p><p className="mt-1 text-xs leading-5 text-slate-600">{medicine.reason}</p></div>
        </div>)}</div>
        {item.alternatives.length>0&&<p className="mt-3 text-xs leading-5 text-slate-700"><b>Commonly used instead:</b> {item.alternatives.join(", ")}</p>}
        <p className="mt-2 text-[10px] leading-4 text-red-900/70">{item.note}</p>
      </article>)}
      <button onClick={load} disabled={loading} className="btn-secondary w-full text-xs disabled:opacity-50"><ArrowPathIcon className={`h-4 w-4 ${loading?"animate-spin":""}`}/>{loading?"Checking allergy cross-reactions…":"Re-check allergy guidance"}</button>
      <p className="text-[10px] leading-4 text-muted">Decision support only: generic drug classes and known cross-reactions, no doses and no prescription. The clinician confirms the allergy and chooses the medicine.</p>
    </div>
  </section>;
}
