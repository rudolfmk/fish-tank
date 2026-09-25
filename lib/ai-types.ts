export type Segment={speaker:string;text:string;start?:number|null;end?:number|null};
export type EvidenceField={value:string|null;evidence:string[];source:"patient"|"nurse"|"doctor"|"unknown"};
export type Extraction=Record<string,EvidenceField>;
export type Suggestion={field:string;question:string};
export type ClinicalFlag={field:string;level:"green"|"yellow"|"red";label:string;evidence:string};
export type SymptomTimelineEntry={day_label:string;description:string;severity?:string|null;evidence:string};
export type AIResult={segments:Segment[];extraction:Extraction;suggestions:Suggestion[];flags?:ClinicalFlag[];symptom_timeline?:SymptomTimelineEntry[];demo?:boolean};
export type ClinicalRecord={patient:Record<string,unknown>;fields:Extraction;status:"ai_generated"|"clinician_verified"};
