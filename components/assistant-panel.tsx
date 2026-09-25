"use client";

import { useMemo, useState } from "react";
import { CheckIcon, SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Suggestion } from "@/lib/ai-types";
import { useDemo } from "./workspace-context";

type Question={id:string;title:string;question:string};
const clinicalFields=["chief_complaint","symptoms","duration","severity","temperature","blood_pressure","heart_rate","respiratory_rate","oxygen_saturation","weight","medical_history","current_medications","allergies","important_notes","examination_findings","diagnosis","treatment","follow_up_instructions"];

export function AssistantPanel({compact=false,suggestions,resolvedFields=[]}:{compact?:boolean;suggestions?:Suggestion[];resolvedFields?:string[]}){
  const {patient}=useDemo();
  const [removed,setRemoved]=useState<Record<string,true>>({});
  const reason=patient.reason.trim();
  const questions=useMemo<Question[]>(()=>{
    const supplied=suggestions||[];
    const suppliedFields=new Set(supplied.map(item=>item.field));
    const missingQuestions=clinicalFields.filter(field=>!resolvedFields.includes(field)&&!suppliedFields.has(field)).map(field=>({field,question:questionForField(field)}));
    const source:Suggestion[]=[...supplied,...missingQuestions];
    return source.map((suggestion,index)=>{
      const field=suggestion.field;
      const original=suggestion.question;
      const question=customizeQuestion(field,original,reason);
      return {id:`${field}:${question}:${index}`,title:field.replaceAll("_"," "),question};
    });
  },[suggestions,reason]);
  const unresolved=questions.filter(question=>!removed[question.id]&&!resolvedFields.includes(question.title.replaceAll(" ","_")));
  const visible=compact?unresolved.slice(0,2):unresolved;
  const remove=(id:string)=>setRemoved(current=>({...current,[id]:true}));

  return <div className="card overflow-hidden"><div className="border-b border-line bg-gradient-to-r from-teal-50 to-white p-5"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-700 text-white"><SparklesIcon className="h-4 w-4"/></span><div><h3 className="text-sm font-bold">Documentation Assistant</h3><p className="text-[10px] text-muted">Questions tailored to the reason for visit</p></div></div></div>
    <div className="space-y-3 p-4">{visible.length?visible.map(item=><div key={item.id} className="rounded-xl border border-line p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-amber-700">Potentially missing</p><p className="mt-1 text-sm font-bold capitalize">{item.title}</p></div><span className="rounded-md bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase text-amber-700">Review</span></div><p className="mt-3 rounded-lg bg-canvas p-3 text-xs leading-5 text-muted">“{item.question}”</p><div className="mt-3 flex gap-2"><button onClick={()=>remove(item.id)} className="flex items-center gap-1 text-[11px] font-bold text-teal-700"><CheckIcon className="h-3.5 w-3.5"/> Mark addressed</button><button onClick={()=>remove(item.id)} className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-muted"><XMarkIcon className="h-3.5 w-3.5"/> Dismiss</button></div></div>):<div className="rounded-xl bg-teal-50 p-5 text-center"><CheckIcon className="mx-auto h-5 w-5 text-teal-700"/><p className="mt-2 text-xs font-bold text-teal-900">All suggested questions reviewed</p></div>}</div>
  </div>;
}

function questionForField(field:string){const questions:Record<string,string>={chief_complaint:"What is the patient's main concern today?",symptoms:"What symptoms is the patient currently experiencing?",duration:"When did the current concern begin, and has it changed?",severity:"How severe are the symptoms?",temperature:"What is the patient's measured temperature?",blood_pressure:"What is the patient's measured blood pressure?",heart_rate:"What is the patient's measured heart rate?",respiratory_rate:"What is the patient's measured respiratory rate?",oxygen_saturation:"What is the patient's measured oxygen saturation?",weight:"What is the patient's current measured weight?",medical_history:"What relevant medical history does the patient have?",current_medications:"What medicines is the patient currently taking?",allergies:"Does the patient have any known allergies and reactions?",important_notes:"Are there any other important observations or concerns?",examination_findings:"What relevant examination findings were observed?",diagnosis:"Has the clinician documented an assessment or diagnosis?",treatment:"What treatment plan was discussed?",follow_up_instructions:"What follow-up and safety-net instructions were discussed?"};return questions[field]||`Could you clarify ${field.replaceAll("_"," ")}?`}

function customizeQuestion(field:string,original:string,reason:string){
  if(!reason)return original;
  const visit=`“${reason}”`;
  const tailored:Record<string,string>={
    chief_complaint:`The recorded reason for visit is ${visit}. Is that accurate, and what is the patient's main concern today?`,
    symptoms:`What symptoms is the patient experiencing in connection with ${visit}?`,
    duration:`When did the concern described as ${visit} begin, and how has it changed?`,
    severity:`How severe is the concern described as ${visit}, and how is it affecting daily activities?`,
    temperature:`What is the patient's measured temperature?`,
    blood_pressure:`What is the patient's measured blood pressure?`,
    heart_rate:`What is the patient's measured heart rate?`,
    respiratory_rate:`What is the patient's measured respiratory rate?`,
    oxygen_saturation:`What is the patient's measured oxygen saturation?`,
    weight:`What is the patient's current measured weight?`,
    medical_history:`Is there any medical history relevant to ${visit}?`,
    current_medications:`What medicines is the patient currently taking, including anything used for ${visit}?`,
    allergies:`Does the patient have any allergies that may affect care for ${visit}?`,
    important_notes:`Are there any other important observations or concerns relevant to ${visit}?`,
    examination_findings:`What examination findings are relevant to ${visit}?`,
    diagnosis:`Has the clinician documented an assessment related to ${visit}?`,
    treatment:`What treatment plan, if any, was discussed for ${visit}?`,
    follow_up_instructions:`What follow-up or safety-net instructions were discussed for ${visit}?`,
  };
  return tailored[field]||original;
}
