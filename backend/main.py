import json
import os
import re
import base64
import tempfile
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

app = FastAPI(title="Clarity Care AI", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], allow_methods=["*"], allow_headers=["*"])

FIELDS = ["chief_complaint", "symptoms", "duration", "severity", "temperature", "blood_pressure", "heart_rate", "respiratory_rate", "oxygen_saturation", "weight", "medical_history", "current_medications", "allergies", "important_notes", "examination_findings", "diagnosis", "treatment", "follow_up_instructions"]

class Segment(BaseModel):
    speaker: str
    text: str
    start: float | None = None
    end: float | None = None

class EvidenceField(BaseModel):
    value: str | None = None
    evidence: list[str] = Field(default_factory=list)
    source: Literal["patient", "nurse", "doctor", "unknown"] = "unknown"

class Extraction(BaseModel):
    chief_complaint: EvidenceField
    symptoms: EvidenceField
    duration: EvidenceField
    severity: EvidenceField
    temperature: EvidenceField
    blood_pressure: EvidenceField
    heart_rate: EvidenceField
    respiratory_rate: EvidenceField
    oxygen_saturation: EvidenceField
    weight: EvidenceField
    medical_history: EvidenceField
    current_medications: EvidenceField
    allergies: EvidenceField
    important_notes: EvidenceField
    examination_findings: EvidenceField
    diagnosis: EvidenceField
    treatment: EvidenceField
    follow_up_instructions: EvidenceField

class Suggestion(BaseModel):
    field: str
    question: str

class ClinicalFlag(BaseModel):
    field: str
    level: Literal["green", "yellow", "red"]
    label: str
    evidence: str

class SymptomTimelineEntry(BaseModel):
    day_label: str
    description: str
    severity: str | None = None
    evidence: str

class Analysis(BaseModel):
    extraction: Extraction
    suggestions: list[Suggestion]
    flags: list[ClinicalFlag]
    symptom_timeline: list[SymptomTimelineEntry]

class DiarizedTranscript(BaseModel):
    segments: list[Segment]

class TranscriptRequest(BaseModel):
    segments: list[Segment]
    role: Literal["nurse", "doctor"]

class RecordRequest(BaseModel):
    reception: dict
    nurse: list[Segment]
    doctor: list[Segment]

class OutputRequest(BaseModel):
    record: dict

ROLE_PATTERNS = {
    "Patient": [r"\b(?:i am|i'm|this is)\s+(?:(?:the|a|am)\s+){0,3}patient\b", r"\b(?:i am|i'm|this is)\s+[a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*)?\s*,?\s+(?:the\s+|a\s+)?patient\b"],
    "Nurse": [r"\b(?:i am|i'm|this is)\s+(?:(?:the|a|am)\s+){0,3}(?:registered\s+)?nurse\b", r"\b(?:i am|i'm|this is)\s+[a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*)?\s*,?\s+(?:the\s+|a\s+)?nurse\b"],
    "Doctor": [r"\b(?:i am|i'm|this is)\s+(?:(?:the|a|am)\s+){0,3}(?:doctor|physician|clinician)\b", r"\b(?:i am|i'm|this is)\s+[a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*)?\s*,?\s+(?:the\s+|a\s+)?(?:doctor|physician|clinician)\b"],
}

def attribute_explicit_speakers(segments: list[Segment]) -> list[Segment]:
    """Maps a diarization label to a role only after explicit self-identification."""
    label_roles: dict[str, str] = {}
    for segment in segments:
        for role, patterns in ROLE_PATTERNS.items():
            if any(re.search(pattern, segment.text, re.IGNORECASE) for pattern in patterns):
                label_roles[segment.speaker] = role
                break
    return [segment.model_copy(update={"speaker": label_roles.get(segment.speaker, segment.speaker)}) for segment in segments]

def client() -> OpenAI:
    key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(503, "No server-side AI API key is configured.")
    if os.getenv("OPENROUTER_API_KEY"):
        return OpenAI(api_key=key, base_url="https://openrouter.ai/api/v1")
    return OpenAI(api_key=key)

def analyze(segments: list[Segment], role: str) -> Analysis:
    transcript = "\n".join(f"{s.speaker}: {s.text}" for s in segments)
    system = """You are a clinical documentation extraction tool, not a clinician. Extract only facts explicitly supported by the transcript. Never infer, diagnose, prescribe, or recommend treatment. Use null when absent. Every non-null value must include short verbatim transcript evidence. The source is patient, nurse, doctor, or unknown; do not infer a role from anonymous speaker labels. Suggestions are neutral documentation clarification prompts only and must never recommend a diagnosis or treatment. Also identify evidence-backed severity and clarity flags tied to a clinical field. GREEN means the transcript explicitly establishes a reassuring, absent, mild, stable, or low-concern finding. RED means the transcript explicitly establishes a severe, worsening, urgent, high-risk, or otherwise concerning finding. YELLOW means relevant information is missing, ambiguous, conflicting, or its severity is not established. Color represents clinical severity or clarity only; never label a field green merely because it was captured. Every flag must identify its related field and include a short verbatim evidence quote when one exists. Do not infer severity that the transcript does not state. Build symptom_timeline only from explicit chronology stated in the transcript, such as Day 1, the next day, yesterday, or a clearly stated onset/change. Preserve the stated day label, describe what the patient felt, and attach a verbatim evidence quote. Never invent intermediate days or reorder uncertain events. Return an empty symptom_timeline when no chronology is supported."""
    ai = client()
    if os.getenv("OPENROUTER_API_KEY"):
        stream = ai.chat.completions.create(
            model=os.getenv("OPENROUTER_TEXT_MODEL", "google/gemini-3.6-flash"),
            messages=[{"role":"system","content":system + " Return valid JSON matching the requested clinical extraction schema."},{"role":"user","content":f"Encounter role: {role}\nTranscript:\n{transcript}\nJSON schema:\n{json.dumps(Analysis.model_json_schema())}"}],
            response_format={"type":"json_schema","json_schema":{"name":"clinical_analysis","strict":True,"schema":Analysis.model_json_schema()}},
            temperature=0,
            stream=True,
            stream_options={"include_usage": True},
        )
        parts: list[str] = []
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                parts.append(chunk.choices[0].delta.content)
        content = "".join(parts)
        if not content: raise HTTPException(502, "The AI did not return structured clinical information.")
        return complete_missing_questions(Analysis.model_validate_json(content))
    completion = ai.beta.chat.completions.parse(model=os.getenv("OPENAI_TEXT_MODEL", "gpt-4o-mini"), messages=[{"role":"system","content":system},{"role":"user","content":f"Encounter role: {role}\nTranscript:\n{transcript}"}], response_format=Analysis, temperature=0)
    parsed = completion.choices[0].message.parsed
    if not parsed: raise HTTPException(502, "The AI did not return structured clinical information.")
    return complete_missing_questions(parsed)

def complete_missing_questions(result: Analysis) -> Analysis:
    """Keep questions aligned with semantic extraction, not transcript wording."""
    extraction = result.extraction.model_dump()
    missing = [field for field in FIELDS if not (extraction.get(field) or {}).get("value")]
    supplied = {suggestion.field: suggestion for suggestion in result.suggestions if suggestion.field in missing}
    questions = {
        "chief_complaint": "What is the patient's main concern today?",
        "symptoms": "What symptoms is the patient currently experiencing?",
        "duration": "When did the symptoms begin, and how have they changed?",
        "severity": "How severe are the symptoms, and how are they affecting daily activities?",
        "temperature": "What is the patient's measured temperature?",
        "blood_pressure": "What is the patient's measured blood pressure?",
        "heart_rate": "What is the patient's measured heart rate?",
        "respiratory_rate": "What is the patient's measured respiratory rate?",
        "oxygen_saturation": "What is the patient's measured oxygen saturation?",
        "weight": "What is the patient's current measured weight?",
        "medical_history": "What relevant medical conditions or previous illnesses does the patient have?",
        "current_medications": "What medicines is the patient currently taking?",
        "allergies": "Does the patient have any known allergies and reactions?",
        "important_notes": "Are there any other important observations or concerns?",
        "examination_findings": "What relevant examination findings were observed?",
        "diagnosis": "Has the clinician documented an assessment or diagnosis?",
        "treatment": "What treatment plan, if any, was discussed?",
        "follow_up_instructions": "What follow-up and safety-net instructions were discussed?",
    }
    suggestions = [supplied.get(field) or Suggestion(field=field, question=questions[field]) for field in missing]
    return result.model_copy(update={"suggestions": suggestions})

@app.get("/health")
def health(): return {"status":"ok", "mode":"openrouter" if os.getenv("OPENROUTER_API_KEY") else "openai" if os.getenv("OPENAI_API_KEY") else "unconfigured"}

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), role: Literal["nurse", "doctor"] = Form(...)):
    if not file.content_type or not (file.content_type.startswith("audio/") or file.filename.endswith((".webm",".wav",".mp3",".m4a",".mp4",".ogg"))):
        raise HTTPException(400, "Please upload a supported audio file.")
    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    data = await file.read()
    if len(data) > 25 * 1024 * 1024: raise HTTPException(413, "Audio file exceeds the 25 MB limit.")
    if os.getenv("OPENROUTER_API_KEY"):
        try:
            audio_format = suffix.lower().lstrip(".")
            if audio_format == "m4a": audio_format = "mp4"
            prompt = """Transcribe this clinical conversation exactly and separate distinct voices using stable neutral labels such as Speaker 1 and Speaker 2. Do not guess roles from context, vocabulary, pitch, accent, or gender. Preserve self-identification phrases exactly. Include approximate start and end times in seconds when available. Return only JSON matching the supplied schema."""
            completion = client().chat.completions.create(
                model=os.getenv("OPENROUTER_TEXT_MODEL", "google/gemini-3.6-flash"),
                messages=[{"role":"user","content":[
                    {"type":"text","text":prompt},
                    {"type":"input_audio","input_audio":{"data":base64.b64encode(data).decode("ascii"),"format":audio_format}},
                ]}],
                response_format={"type":"json_schema","json_schema":{"name":"diarized_transcript","strict":True,"schema":DiarizedTranscript.model_json_schema()}},
                temperature=0,
            )
            content = completion.choices[0].message.content
            if not content: raise ValueError("The model returned an empty transcript")
            diarized = DiarizedTranscript.model_validate_json(content)
            segments = attribute_explicit_speakers(diarized.segments)
            analysis = analyze(segments, role)
            return {"segments":[segment.model_dump() for segment in segments], **analysis.model_dump(), "demo":False}
        except Exception as exc:
            raise HTTPException(502, f"OpenRouter audio transcription failed: {str(exc)}")
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(501, "No server-side audio transcription provider is configured.")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data); path=tmp.name
    try:
        with open(path,"rb") as audio:
            result=client().audio.transcriptions.create(model=os.getenv("OPENAI_TRANSCRIPTION_MODEL","gpt-4o-transcribe-diarize"),file=audio,response_format="diarized_json",chunking_strategy="auto")
        segments=attribute_explicit_speakers([Segment(speaker=str(x.speaker),text=x.text,start=x.start,end=x.end) for x in result.segments])
        analysis=analyze(segments,role)
        return {"segments":[s.model_dump() for s in segments],**analysis.model_dump(),"demo":False}
    except HTTPException: raise
    except Exception as exc: raise HTTPException(502, f"Transcription failed: {str(exc)}")
    finally: os.unlink(path)

@app.post("/extract", response_model=Analysis)
def extract(req: TranscriptRequest): return analyze(req.segments, req.role)

@app.post("/clinical-record")
def clinical_record(req: RecordRequest):
    combined=req.nurse+req.doctor
    result=analyze(combined,"doctor")
    return {"patient":req.reception,"fields":result.extraction.model_dump(),"status":"ai_generated"}

@app.post("/outputs")
def outputs(req: OutputRequest):
    if req.record.get("status") != "clinician_verified": raise HTTPException(400,"Only clinician-verified records can generate final outputs.")
    f=req.record.get("fields",{})
    val=lambda k: (f.get(k) or {}).get("value") or "Not documented"
    medication = val("current_medications") if (f.get("current_medications") or {}).get("source") == "doctor" else "No clinician-documented medication"
    return {"insurance":{"clinical_summary":f"{val('chief_complaint')}. Symptoms: {val('symptoms')}. Duration: {val('duration')}.","diagnosis":val("diagnosis"),"procedures":val("examination_findings"),"clinical_justification":"Based only on the verified chief complaint, symptoms, examination, and clinician documentation.","supporting_evidence":sum([(f.get(k) or {}).get("evidence",[]) for k in FIELDS],[])},"pharmacy":{"medication":medication,"dosage":"Not documented","frequency":"Not documented","duration":"Not documented","instructions":val("treatment") if medication != "No clinician-documented medication" else "Not documented","allergies":val("allergies")},"patient":{"what_happened":f"You were seen for {val('chief_complaint').lower()}.","clinician_documented":val("diagnosis"),"medication_instructions":medication,"follow_up":val("follow_up_instructions"),"warnings":val("follow_up_instructions")}}
