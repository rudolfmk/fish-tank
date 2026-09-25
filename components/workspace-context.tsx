"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { emptyPatient, type Patient } from "@/lib/workspace-data";
import type { AIResult, ClinicalRecord } from "@/lib/ai-types";
import { isSupabaseConfigured, loadDemoPatient, syncDemoPatient } from "@/lib/supabase";

type Outputs=Record<string,Record<string,unknown>>;
type Ctx={patient:Patient;savePatient:(patient:Patient)=>void;sent:boolean;setSent:(value:boolean)=>void;nurseResult:AIResult|null;doctorResult:AIResult|null;setResult:(role:"nurse"|"doctor",result:AIResult)=>void;resetStage:(role:"nurse"|"doctor")=>void;record:ClinicalRecord|null;setRecord:(record:ClinicalRecord)=>void;outputs:Outputs|null;setOutputs:(outputs:Outputs)=>void;resetWorkspace:()=>void;supabaseConnected:boolean;syncError:string|null};
const WorkspaceContext=createContext<Ctx|null>(null);

const readStored=<T,>(key:string):T|null=>{try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}};

export function WorkspaceProvider({children}:{children:React.ReactNode}){
  const [patient,setPatient]=useState<Patient>(emptyPatient);
  const [sent,setSent]=useState(false);
  const [nurseResult,setNurseResult]=useState<AIResult|null>(null);
  const [doctorResult,setDoctorResult]=useState<AIResult|null>(null);
  const [record,setRecordState]=useState<ClinicalRecord|null>(null);
  const [outputs,setOutputsState]=useState<Outputs|null>(null);
  const [supabaseConnected,setSupabaseConnected]=useState(false);
  const [syncError,setSyncError]=useState<string|null>(null);

  useEffect(()=>{
    const storedPatient=readStored<Patient>("clarity-patient");
    const storedNurse=readStored<AIResult>("clarity-nurse");
    const storedDoctor=readStored<AIResult>("clarity-doctor");
    const legacyPatient=storedPatient?.id==="PT-2048"&&storedPatient?.name==="Maya Thompson";
    if(storedPatient&&!legacyPatient){setPatient(storedPatient);setSent(true)}else if(legacyPatient){localStorage.removeItem("clarity-patient")}
    if(storedNurse&&!storedNurse.demo)setNurseResult(storedNurse);else localStorage.removeItem("clarity-nurse");
    if(storedDoctor&&!storedDoctor.demo)setDoctorResult(storedDoctor);else localStorage.removeItem("clarity-doctor");
    if(!legacyPatient){setRecordState(readStored("clarity-record"));setOutputsState(readStored("clarity-outputs"))}else{"clarity-record clarity-outputs".split(" ").forEach(key=>localStorage.removeItem(key))}
    if(isSupabaseConfigured)loadDemoPatient().then(remote=>{if(remote&&!legacyPatient){setPatient(remote);setSent(true)}setSupabaseConnected(true)}).catch(error=>setSyncError(error instanceof Error?error.message:"Supabase connection failed"));
  },[]);

  const savePatient=(next:Patient)=>{setPatient(next);setSent(true);localStorage.setItem("clarity-patient",JSON.stringify(next));if(isSupabaseConfigured)syncDemoPatient(next).then(()=>{setSupabaseConnected(true);setSyncError(null)}).catch(error=>setSyncError(error instanceof Error?error.message:"Supabase sync failed"))};
  const setResult=(role:"nurse"|"doctor",result:AIResult)=>{(role==="nurse"?setNurseResult:setDoctorResult)(result);localStorage.setItem(`clarity-${role}`,JSON.stringify(result))};
  const resetStage=(role:"nurse"|"doctor")=>{if(role==="nurse"){setNurseResult(null);setDoctorResult(null);["clarity-nurse","clarity-doctor"].forEach(key=>localStorage.removeItem(key))}else{setDoctorResult(null);localStorage.removeItem("clarity-doctor")}setRecordState(null);setOutputsState(null);["clarity-record","clarity-outputs"].forEach(key=>localStorage.removeItem(key))};
  const setRecord=(next:ClinicalRecord)=>{setRecordState(next);localStorage.setItem("clarity-record",JSON.stringify(next))};
  const setOutputs=(next:Outputs)=>{setOutputsState(next);localStorage.setItem("clarity-outputs",JSON.stringify(next))};
  const resetWorkspace=()=>{setPatient(emptyPatient);setSent(false);setNurseResult(null);setDoctorResult(null);setRecordState(null);setOutputsState(null);["clarity-patient","clarity-nurse","clarity-doctor","clarity-record","clarity-outputs"].forEach(key=>localStorage.removeItem(key))};
  return <WorkspaceContext.Provider value={{patient,savePatient,sent,setSent,nurseResult,doctorResult,setResult,resetStage,record,setRecord,outputs,setOutputs,resetWorkspace,supabaseConnected,syncError}}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace=()=>{const context=useContext(WorkspaceContext);if(!context)throw new Error("WorkspaceProvider missing");return context};

// Temporary aliases keep existing pages compatible while the UI naming is migrated.
export const DemoProvider=WorkspaceProvider;
export const useDemo=useWorkspace;
