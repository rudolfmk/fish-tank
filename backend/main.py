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

class ClaimsRequest(BaseModel):
    fields: dict[str, EvidenceField]
    segments: list[Segment]

class ClaimVerdict(BaseModel):
    field: str
    status: Literal["supported", "partial", "unsupported"]
    unsupported_text: str | None
    reason: str

class ClaimsReport(BaseModel):
    verdicts: list[ClaimVerdict]

class RedFlagRequest(BaseModel):
    segments: list[Segment]

class RedFlagAlert(BaseModel):
    condition: str
    urgency: Literal["emergency", "urgent"]
    triggers: list[str]
    rationale: str
    clinician_check: str

class RedFlagReport(BaseModel):
    alerts: list[RedFlagAlert]

class PatientSummaryRequest(BaseModel):
    record: dict
    language: str = Field(min_length=2, max_length=40)

class SummaryHeadings(BaseModel):
    what_happened: str
    what_clinician_found: str
    medicines: str
    self_care: str
    next_steps: str
    urgent_help: str

class PatientSummary(BaseModel):
    headings: SummaryHeadings
    greeting: str
    what_happened: str
    what_clinician_found: str
    medicines: str
    self_care: str
    next_steps: str
    urgent_help: str

def normalize(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text.lower()).split())

def in_transcript(quote: str, transcript: str) -> bool:
    quote = normalize(quote)
    return bool(quote) and quote in transcript

def structured(system: str, user: str, schema: type[BaseModel], name: str):
    ai = client()
    if os.getenv("OPENROUTER_API_KEY"):
        completion = ai.chat.completions.create(
            model=os.getenv("OPENROUTER_TEXT_MODEL", "google/gemini-3.6-flash"),
            messages=[{"role":"system","content":system + " Return valid JSON matching the supplied schema."},{"role":"user","content":f"{user}\nJSON schema:\n{json.dumps(schema.model_json_schema())}"}],
            response_format={"type":"json_schema","json_schema":{"name":name,"strict":True,"schema":schema.model_json_schema()}},
            temperature=0,
        )
        content = completion.choices[0].message.content
        if not content: raise HTTPException(502, "The AI returned an empty response.")
        return schema.model_validate_json(content)
    completion = ai.beta.chat.completions.parse(model=os.getenv("OPENAI_TEXT_MODEL", "gpt-4o-mini"), messages=[{"role":"system","content":system},{"role":"user","content":user}], response_format=schema, temperature=0)
    parsed = completion.choices[0].message.parsed
    if not parsed: raise HTTPException(502, "The AI returned an empty response.")
    return parsed

def transcript_text(segments: list[Segment]) -> str:
    return "\n".join(f"{s.speaker}: {s.text}" for s in segments)

@app.post("/claims-check")
def claims_check(req: ClaimsRequest):
    claims = {key: field for key, field in req.fields.items() if field.value and field.value.strip()}
    if not claims: return {"results": {}}
    if not req.segments: raise HTTPException(400, "A saved transcript is required to check claims.")
    transcript = transcript_text(req.segments)
    system = """You are a strict fact-checker for clinical documentation. For each claim, decide whether every factual statement in its value is directly stated in the transcript. supported: everything in the value is stated (faithful paraphrase is fine). partial: some statements are stated but at least one is not. unsupported: nothing in the value is stated. Anything inferred, generalized, or added is not supported: diagnoses the clinician never said, numbers, doses, durations, frequencies, body sites, or negations that do not appear. For partial or unsupported, copy the exact unsupported words from the claim value into unsupported_text; otherwise use null. reason is one short sentence. Return exactly one verdict per claim, using the claim's field key."""
    claim_lines = "\n".join(f"- {key}: {field.value}" for key, field in claims.items())
    report = structured(system, f"Transcript:\n{transcript}\n\nClaims:\n{claim_lines}", ClaimsReport, "claims_report")
    verdicts = {verdict.field: verdict for verdict in report.verdicts if verdict.field in claims}
    normalized = normalize(transcript)
    results = {}
    for key, field in claims.items():
        verdict = verdicts.get(key) or ClaimVerdict(field=key, status="partial", unsupported_text=None, reason="The checker did not return a verdict for this field.")
        fabricated = [quote for quote in field.evidence if not in_transcript(quote, normalized)]
        status = "partial" if verdict.status == "supported" and fabricated else verdict.status
        reason = "Cited evidence does not appear in the transcript." if status != verdict.status else verdict.reason
        results[key] = {"status": status, "unsupported_text": verdict.unsupported_text, "reason": reason, "fabricated_quotes": fabricated}
    return {"results": results}

@app.post("/red-flags")
def red_flags(req: RedFlagRequest):
    transcript = transcript_text(req.segments)
    if len(normalize(transcript)) < 12: return {"alerts": []}
    system = """You are a clinical safety net that surfaces red-flag symptom patterns for a clinician to review. You do not diagnose or recommend treatment. Raise an alert only when the transcript explicitly contains the red-flag features of a time-critical condition, for example: sepsis, stroke (face droop, arm weakness, speech difficulty, sudden onset), acute coronary syndrome, pulmonary embolism, anaphylaxis, meningitis, subarachnoid haemorrhage (sudden worst-ever headache), suicidal ideation or self-harm, diabetic emergency, severe dehydration, ectopic pregnancy, cauda equina syndrome, gastrointestinal bleeding, or severe asthma. Symptoms the speaker denies (for example "no chest pain") must never trigger an alert. Each trigger must be a short quote copied verbatim from the transcript. urgency is emergency for immediately life-threatening patterns and urgent otherwise. rationale is one sentence linking the triggers to the pattern. clinician_check is one neutral next check to confirm or rule out the pattern, with no treatment advice. Return an empty alerts list when nothing qualifies."""
    report = structured(system, f"Transcript:\n{transcript}", RedFlagReport, "red_flag_report")
    normalized = normalize(transcript)
    alerts = []
    for alert in report.alerts:
        triggers = [quote for quote in alert.triggers if in_transcript(quote, normalized)]
        if triggers: alerts.append(alert.model_copy(update={"triggers": triggers}).model_dump())
    return {"alerts": alerts}

@app.post("/patient-summary", response_model=PatientSummary)
def patient_summary(req: PatientSummaryRequest):
    if req.record.get("status") != "clinician_verified": raise HTTPException(400, "Only clinician-verified records can generate patient summaries.")
    f = req.record.get("fields", {})
    name = str((req.record.get("patient") or {}).get("name") or "").split(" ")[0]
    facts = "\n".join(f"- {key}: {(f.get(key) or {}).get('value') or 'Not documented'}" for key in FIELDS)
    system = f"""Write a warm, plain-language visit summary addressed directly to the patient, entirely in {req.language}, at about a 6th-grade reading level. Use only facts from the verified record; never invent diagnoses, medicines, doses, tests, or instructions, and do not add medical advice beyond the record. Explain medical terms in simple words. When a topic is Not documented, say briefly that it was not discussed. greeting uses the patient's first name if given. medicines covers only clinician-documented medication. headings holds the section titles, also translated: what happened today, what your clinician documented, your medicines, taking care of yourself, what happens next, and when to get urgent help. medicines must state any documented allergy and what the patient should not take. urgent_help uses the record's follow-up and safety-net instructions; if there are none, tell the patient to contact the clinic or emergency services if they feel much worse. Each section is 1-3 short sentences."""
    return structured(system, f"Patient first name: {name or 'unknown'}\nVerified record:\n{facts}", PatientSummary, "patient_summary")

class AllergyRequest(BaseModel):
    segments: list[Segment]
    allergies: str | None = None
    current_medications: str | None = None

class AvoidMedicine(BaseModel):
    medicine: str
    drug_class: str
    risk: Literal["avoid", "caution"]
    reason: str

class AllergyGuidance(BaseModel):
    allergen: str
    reaction: str | None
    evidence: str
    avoid: list[AvoidMedicine]
    alternatives: list[str]
    note: str

class AllergyReport(BaseModel):
    guidance: list[AllergyGuidance]

@app.post("/allergy-guidance")
def allergy_guidance(req: AllergyRequest):
    transcript = transcript_text(req.segments)
    documented = ", ".join(part for part in [req.allergies, req.current_medications] if part and part.strip())
    if not normalize(transcript) and not normalize(documented): return {"guidance": []}
    system = """You support a clinician by listing medicines to avoid for allergies the patient explicitly reported. Create one entry per distinct documented allergen; ignore allergens that are only denied or absent, and return an empty list when none are documented. allergen is the substance as documented. reaction is what the patient said happened, or null. evidence is a short quote copied verbatim from the transcript. avoid lists the allergen's own drug class first, then well-established cross-reactive or same-class medicines, giving each a generic medicine name, its drug class, risk (avoid for the same class or a well-established cross-reaction, caution for a possible or lower-rate cross-reaction), and a one-sentence reason that names the mechanism or cross-reactivity. alternatives lists generic medicines from unrelated classes that are commonly used for the same purpose, with no doses. note is one sentence reminding the clinician to confirm the allergy and choose the medicine themselves. Use generic drug names, never brand names, and never give doses, prescriptions, or treatment recommendations."""
    report = structured(system, f"Transcript:\n{transcript}\n\nDocumented allergies and medications: {documented or 'none recorded'}", AllergyReport, "allergy_report")
    normalized = normalize(transcript)
    return {"guidance": [item.model_dump() for item in report.guidance if in_transcript(item.evidence, normalized) or normalize(item.allergen) in normalize(documented)]}
