# Clarity Care hackathon MVP

Synthetic-data healthcare documentation workflow with a Next.js frontend and FastAPI AI service.

## Run the frontend

```bash
npm install
npm run dev
```

## Run the AI backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

For OpenRouter-powered extraction with streamed Gemini 3.6 Flash responses,
create `backend/.env` from `backend/.env.example`, add a rotated key, and run:

```bash
cd backend
uvicorn main:app --reload --port 8000 --env-file .env
```

For optional server-side audio transcription, add an OpenAI key as well. Without
it, supported browsers preserve their real live speech transcript and send that
text to OpenRouter for extraction:

```bash
OPENAI_API_KEY="your-key" uvicorn main:app --reload --port 8000 --env-file .env
```

The frontend calls the backend through the same-origin `/api` proxy (see `next.config.ts`), which forwards to `BACKEND_URL` (default `http://localhost:8000`). Set `BACKEND_URL` when the backend runs elsewhere. Never put `OPENAI_API_KEY` in a `NEXT_PUBLIC_*` variable.

## Demo flow

1. Register the synthetic patient at `/reception`.
2. Record or upload audio at `/nurse`, review transcript evidence and prompts, then hand off.
3. Record or upload the doctor consultation and complete it.
4. Review/edit the AI-generated record, inspect supporting transcript evidence, and verify it.
5. View insurance, pharmacy, and patient outputs generated only from the verified record.

AI-generated information must be reviewed and verified by a qualified healthcare professional before clinical use.

## Supabase database

The complete database migration is in [`supabase/schema.sql`](./supabase/schema.sql). It includes the synthetic demo seed, private clinical-audio bucket, source evidence, clinician verification gates, stakeholder outputs, audit history, indexes, and row-level security. See [`supabase/README.md`](./supabase/README.md) for setup instructions.
