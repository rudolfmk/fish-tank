import { AIResult, ClinicalRecord, Segment } from "./ai-types";
const base=process.env.NEXT_PUBLIC_API_URL||"http://localhost:8000";
async function request<T>(path:string,init:RequestInit):Promise<T>{const r=await fetch(base+path,init);if(!r.ok){let msg=`Request failed (${r.status})`;try{msg=(await r.json()).detail||msg}catch{}throw new Error(msg)}return r.json()}
export async function transcribeAudio(blob:Blob,role:"nurse"|"doctor",filename="recording.webm"){const form=new FormData();form.append("file",blob,filename);form.append("role",role);return request<AIResult>("/transcribe",{method:"POST",body:form})}
export async function analyzeTranscript(segments:Segment[],role:"nurse"|"doctor"){return request<Omit<AIResult,"segments">>("/extract",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({segments,role})})}
export async function createRecord(reception:Record<string,unknown>,nurse:Segment[],doctor:Segment[]){return request<ClinicalRecord>("/clinical-record",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reception,nurse,doctor})})}
export async function generateOutputs(record:ClinicalRecord){return request<Record<string,Record<string,unknown>>>("/outputs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({record})})}
