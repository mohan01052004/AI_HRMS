"""
routes/ai.py — All AI-powered features using Groq API (Free tier)
Model: llama-3.3-70b-versatile (fast, free, highly capable)
Get your free API key at: https://console.groq.com
"""
from fastapi import APIRouter, Depends, HTTPException, Body, File, Form, UploadFile
import fitz
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import json
import asyncio
import uuid
import os
from typing import List
from groq import Groq

from database import get_db, get_mongo_db, get_settings
from models.user import User
from models.payroll import PerformanceReview
from auth.jwt_handler import get_current_user, require_hr

router = APIRouter(prefix="/ai", tags=["AI Features"])
settings = get_settings()

# ─── Model config ─────────────────────────────────────────────────────────────

GROQ_MODEL       = "llama-3.3-70b-versatile"   # Best quality, free
GROQ_MODEL_FAST  = "llama3-8b-8192"            # Faster for simple tasks


def get_groq_client() -> Groq:
    """Return an authenticated Groq client."""
    if not settings.groq_api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "GROQ_API_KEY is not configured. "
                "Get a free key at https://console.groq.com and add it to backend/.env, "
                "then restart the backend."
            ),
        )
    return Groq(api_key=settings.groq_api_key)


def _chat(client: Groq, messages: list, model: str = GROQ_MODEL,
           temperature: float = 0.7, max_tokens: int = 1024,
           json_mode: bool = False) -> str:
    """Single helper that calls the Groq chat completions API."""
    kwargs = dict(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    response = client.chat.completions.create(**kwargs)
    return response.choices[0].message.content


def _extract_json(text: str) -> dict:
    """Strip markdown fences and parse JSON."""
    text = text.strip()
    if "```" in text:
        parts = text.split("```")
        if len(parts) >= 3:
            text = parts[1]
            if text.startswith("json"):
                text = text[4:]
    return json.loads(text.strip())


async def _log_ai_call(feature: str, input_summary: str, output_summary: str):
    """Fire-and-forget AI usage log to MongoDB."""
    try:
        db = get_mongo_db()
        await db.ai_logs.insert_one({
            "feature": feature,
            "model": GROQ_MODEL,
            "input_summary": input_summary[:500],
            "output_summary": output_summary[:500],
            "created_at": datetime.now(timezone.utc),
        })
    except Exception:
        pass


# ─── 1. Resume Screening ──────────────────────────────────────────────────────

def _clean_candidate_name(filename: str) -> str:
    """Clean filename to extract a readable candidate name."""
    name = filename.rsplit(".", 1)[0]
    name = name.replace("_", " ").replace("-", " ")
    return name.title()


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract readable text from PDF bytes."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text


@router.post("/screen-resume")
async def screen_resume(
    resume_file: UploadFile = File(...),
    jd_text: str = Form(...),
    candidate_name: str = Form(...),
    _: User = Depends(require_hr),
):
    """
    Extract text from resume PDF, analyze it against the JD using Groq,
    and save the result to MongoDB.
    """
    if not resume_file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported for resume screening."
        )

    try:
        # Extract text from PDF using PyMuPDF (fitz)
        pdf_bytes = await resume_file.read()
        resume_text = _extract_text_from_pdf(pdf_bytes)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse PDF resume file: {str(e)}"
        )

    if not resume_text.strip():
        raise HTTPException(
            status_code=400,
            detail="The uploaded PDF file does not contain any readable text."
        )

    # Call Groq API with prompt using llama-3.3-70b-versatile
    messages = [
        {
            "role": "system",
            "content": "You are an expert HR recruiter. Always respond with valid JSON only — no markdown, conversational text, or backticks.",
        },
        {
            "role": "user",
            "content": f"""You are an expert HR recruiter. Analyze this resume against the job description. Return a JSON object with these exact keys:
score (0-100 integer), matched_skills (array of strings), missing_skills (array of strings), strengths (array of strings), weaknesses (array of strings), recommendation (string: 'Strong Hire' or 'Hire' or 'Maybe' or 'Reject'), summary (2-3 sentence overview)

Job Description:
{jd_text}

Resume Text:
{resume_text}""",
        },
    ]

    try:
        client = get_groq_client()
        result_text = _chat(client, messages, model=GROQ_MODEL, temperature=0.1,
                            max_tokens=2000, json_mode=True)
        analysis = json.loads(result_text)
    except json.JSONDecodeError:
        try:
            analysis = _extract_json(result_text)
        except Exception:
            raise HTTPException(
                status_code=500,
                detail="Failed to parse Groq response as JSON."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Groq API error: {str(e)}")

    # Ensure all required keys exist in the analysis dict
    required_keys = ["score", "matched_skills", "missing_skills", "strengths", "weaknesses", "recommendation", "summary"]
    for key in required_keys:
        if key not in analysis:
            if key == "score":
                analysis[key] = 0
            elif key == "recommendation":
                analysis[key] = "Maybe"
            elif key == "summary":
                analysis[key] = "Could not generate summary."
            else:
                analysis[key] = []

    # Save full result to MongoDB resume_screenings collection
    mongo_db = get_mongo_db()
    document = {
        "candidate_name": candidate_name,
        "jd_text": jd_text,
        "filename": resume_file.filename,
        "created_at": datetime.now(timezone.utc),
        **analysis
    }
    await mongo_db.resume_screenings.insert_one(document)

    if "_id" in document:
        document["_id"] = str(document["_id"])

    await _log_ai_call(
        "resume_screening",
        f"Candidate: {candidate_name}",
        f"Score: {analysis.get('score')}, Rec: {analysis.get('recommendation')}",
    )

    return analysis


@router.post("/bulk-screen-resumes")
async def bulk_screen_resumes(
    resumes: List[UploadFile] = File(...),
    jd_text: str = Form(...),
    job_title: str = Form(...),
    _: User = Depends(require_hr),
):
    """
    Screen multiple PDF resumes concurrently against a JD using Groq AI.
    Saves each result to MongoDB resume_screenings.
    """
    if not resumes:
        raise HTTPException(status_code=400, detail="No resume files were provided.")

    for res in resumes:
        if not res.filename.endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail=f"File {res.filename} is not a PDF. Only PDF files are supported."
            )

    bulk_session_id = f"bulk_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    client = get_groq_client()

    async def process_one(res_file: UploadFile):
        try:
            pdf_bytes = await res_file.read()
            resume_text = _extract_text_from_pdf(pdf_bytes)
        except Exception as e:
            return {
                "filename": res_file.filename,
                "candidate_name": _clean_candidate_name(res_file.filename),
                "error": f"Failed to parse PDF resume: {str(e)}",
                "score": 0,
                "recommendation": "Reject",
                "matched_skills": [],
                "missing_skills": [],
                "strengths": [],
                "weaknesses": [],
                "summary": "Failed to parse PDF resume."
            }

        if not resume_text.strip():
            return {
                "filename": res_file.filename,
                "candidate_name": _clean_candidate_name(res_file.filename),
                "error": "The uploaded PDF file does not contain any readable text.",
                "score": 0,
                "recommendation": "Reject",
                "matched_skills": [],
                "missing_skills": [],
                "strengths": [],
                "weaknesses": [],
                "summary": "PDF has no readable text."
            }

        candidate_name = _clean_candidate_name(res_file.filename)

        messages = [
            {
                "role": "system",
                "content": "You are an expert HR recruiter. Always respond with valid JSON only — no markdown, conversational text, or backticks.",
            },
            {
                "role": "user",
                "content": f"""You are an expert HR recruiter. Analyze this resume against the job description. Return a JSON object with these exact keys:
score (0-100 integer), matched_skills (array of strings), missing_skills (array of strings), strengths (array of strings), weaknesses (array of strings), recommendation (string: 'Strong Hire' or 'Hire' or 'Maybe' or 'Reject'), summary (2-3 sentence overview)

Job Description:
{jd_text}

Resume Text:
{resume_text}""",
            },
        ]

        try:
            result_text = await asyncio.to_thread(
                _chat, client, messages, model=GROQ_MODEL, temperature=0.1, max_tokens=2000, json_mode=True
            )
            analysis = json.loads(result_text)
        except json.JSONDecodeError:
            try:
                analysis = _extract_json(result_text)
            except Exception:
                analysis = {"error": "Failed to parse Groq response as JSON."}
        except Exception as e:
            analysis = {"error": f"Groq API error: {str(e)}"}

        if "error" in analysis:
            return {
                "filename": res_file.filename,
                "candidate_name": candidate_name,
                "error": analysis["error"],
                "score": 0,
                "recommendation": "Maybe",
                "matched_skills": [],
                "missing_skills": [],
                "strengths": [],
                "weaknesses": [],
                "summary": "Could not analyze resume due to an API or JSON error."
            }

        # Ensure all required keys exist
        required_keys = ["score", "matched_skills", "missing_skills", "strengths", "weaknesses", "recommendation", "summary"]
        for key in required_keys:
            if key not in analysis:
                if key == "score":
                    analysis[key] = 0
                elif key == "recommendation":
                    analysis[key] = "Maybe"
                elif key == "summary":
                    analysis[key] = "Could not generate summary."
                else:
                    analysis[key] = []

        # Save to MongoDB
        mongo_db = get_mongo_db()
        document = {
            "candidate_name": candidate_name,
            "jd_text": jd_text,
            "filename": res_file.filename,
            "job_title": job_title,
            "bulk_session_id": bulk_session_id,
            "created_at": datetime.now(timezone.utc),
            **analysis
        }
        await mongo_db.resume_screenings.insert_one(document)

        # Log AI usage
        await _log_ai_call(
            "bulk_resume_screening",
            f"Candidate: {candidate_name} ({res_file.filename})",
            f"Score: {analysis.get('score')}, Rec: {analysis.get('recommendation')}",
        )

        return {
            "filename": res_file.filename,
            "candidate_name": candidate_name,
            **analysis
        }

    sem = asyncio.Semaphore(3)

    async def sem_process(res_file: UploadFile):
        async with sem:
            return await process_one(res_file)

    tasks = [sem_process(res_file) for res_file in resumes]
    results = await asyncio.gather(*tasks)

    # Sort by score descending
    results.sort(key=lambda x: x.get("score", 0), reverse=True)

    return {
        "bulk_session_id": bulk_session_id,
        "results": results
    }


# ─── 2. AI Chatbot ────────────────────────────────────────────────────────────

@router.post("/chat")
async def ai_chat(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_user),
):
    """
    HR AI Assistant "Alex" — conversational chat with history.
    Payload: { message: str, history: [{role, content}] }
    """
    user_message = payload.get("message", "").strip()
    history      = payload.get("history", [])

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    system_prompt = """You are Alex, a friendly and knowledgeable HR Assistant for an AI-powered HRMS platform.
You help employees and managers with:
- HR policies, leave rules, and attendance procedures
- Payroll and salary queries
- Performance review guidance
- Onboarding checklists and processes
- Recruitment and job application processes
- General workplace questions

Keep responses concise, professional, and empathetic.
If asked something outside HR scope, politely redirect to HR-related topics.
Use bullet points when listing multiple items."""

    # Build message list with history (last 10 turns)
    messages = [{"role": "system", "content": system_prompt}]
    for turn in history[-10:]:
        role = turn.get("role", "")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})

    try:
        client = get_groq_client()
        response_text = _chat(client, messages, temperature=0.7, max_tokens=1024)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Groq API error: {str(e)}")

    # Persist chat history to MongoDB
    mongo_db = get_mongo_db()
    new_history = history + [
        {"role": "user",      "content": user_message},
        {"role": "assistant", "content": response_text},
    ]
    await mongo_db.chat_history.update_one(
        {"user_id": current_user.id},
        {"$set": {
            "messages":   new_history[-50:],
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    await _log_ai_call(
        "chat",
        f"User {current_user.id}: {user_message[:100]}",
        response_text[:200],
    )

    return {"response": response_text, "history": new_history[-20:]}


@router.get("/chat/history")
async def get_chat_history(current_user: User = Depends(get_current_user)):
    """Retrieve stored chat history for the logged-in user."""
    mongo_db = get_mongo_db()
    doc = await mongo_db.chat_history.find_one(
        {"user_id": current_user.id}, {"_id": 0}
    )
    return {"history": doc.get("messages", []) if doc else []}


# ─── 3. Performance Summary ───────────────────────────────────────────────────

@router.post("/performance-summary")
async def generate_performance_summary(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a professional AI performance review summary.
    Payload: { review_id, employee_name, period, rating, comments, goals }
    """
    review_id     = payload.get("review_id")
    employee_name = payload.get("employee_name", "Employee")
    period        = payload.get("period", "")
    rating        = payload.get("rating", 0)
    comments      = payload.get("comments", "")
    goals         = payload.get("goals", [])

    goals_text = "\n".join([
        f"- {g.get('title', '')}: {g.get('status', '')} ({g.get('progress', 0)}% complete)"
        for g in goals
    ]) if goals else "No goals recorded."

    messages = [
        {
            "role": "system",
            "content": "You are an HR professional writing formal performance review summaries.",
        },
        {
            "role": "user",
            "content": f"""Write a professional performance review summary (3-4 paragraphs).

Employee: {employee_name}
Review Period: {period}
Overall Rating: {rating}/5.0
Manager Comments: {comments}
Goals & Progress:
{goals_text}

Requirements:
1. Open with an overview of performance this period
2. Highlight key achievements and strengths
3. Address areas for improvement constructively
4. Close with forward-looking development recommendations

Write in formal third-person. Be specific. Do not use generic filler phrases.""",
        },
    ]

    try:
        client = get_groq_client()
        summary = _chat(client, messages, temperature=0.6, max_tokens=1200)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Groq API error: {str(e)}")

    # Save AI summary to the review record in PostgreSQL
    if review_id:
        result = await db.execute(
            select(PerformanceReview).where(PerformanceReview.id == review_id)
        )
        review = result.scalar_one_or_none()
        if review:
            review.ai_summary = summary
            db.add(review)
            await db.flush()

    await _log_ai_call(
        "performance_summary",
        f"{employee_name} / {period}",
        summary[:200],
    )

    return {"summary": summary}


# ─── 4. Payroll Anomaly Detection ────────────────────────────────────────────

@router.post("/payroll-anomaly")
async def detect_payroll_anomalies(
    payload: dict = Body(...),
    _: User = Depends(get_current_user),
):
    """
    Detect payroll anomalies using AI.
    Payload: { records: [{employee_name, month, year, gross, net, deductions}] }
    """
    records = payload.get("records", [])
    if not records:
        raise HTTPException(status_code=400, detail="No payroll records provided.")

    records_text = "\n".join([
        f"- {r.get('employee_name', 'Unknown')}: "
        f"Gross ₹{r.get('gross', 0):,.2f}, "
        f"Deductions ₹{r.get('deductions', 0):,.2f}, "
        f"Net ₹{r.get('net', 0):,.2f} "
        f"({r.get('month', '')}/{r.get('year', '')})"
        for r in records
    ])

    messages = [
        {
            "role": "system",
            "content": "You are a payroll auditor. Always respond with valid JSON only — no markdown.",
        },
        {
            "role": "user",
            "content": f"""Analyze these payroll records for anomalies.

Records:
{records_text}

Flag issues like: net > gross, deductions > 40% of gross, zero/negative values, unusually high/low amounts.

Return ONLY this JSON:
{{
  "anomalies": [
    {{
      "employee": "<name>",
      "issue": "<description>",
      "severity": "high | medium | low",
      "recommendation": "<action>"
    }}
  ],
  "summary": "<overall assessment in 1-2 sentences>",
  "total_reviewed": {len(records)},
  "flagged_count": <number>
}}""",
        },
    ]

    try:
        client = get_groq_client()
        result_text = _chat(client, messages, temperature=0.2,
                            max_tokens=1024, json_mode=True)
        analysis = json.loads(result_text)
    except json.JSONDecodeError:
        analysis = {
            "anomalies": [],
            "summary": "Could not parse AI response. Please retry.",
            "total_reviewed": len(records),
            "flagged_count": 0,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Groq API error: {str(e)}")

    await _log_ai_call(
        "payroll_anomaly",
        f"Records: {len(records)}",
        f"Flagged: {analysis.get('flagged_count', 0)}",
    )

    return analysis


# ─── 5. Workforce Insights ────────────────────────────────────────────────────

@router.get("/insights")
async def workforce_insights(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """AI-generated workforce insights from live database stats."""
    from models.employee import Employee
    from models.leave import LeaveRequest
    from sqlalchemy import func

    total_emp = (await db.execute(select(func.count(Employee.id)))).scalar() or 0
    active_emp = (
        await db.execute(
            select(func.count(Employee.id)).where(Employee.status == "active")
        )
    ).scalar() or 0
    pending_leaves = (
        await db.execute(
            select(func.count(LeaveRequest.id)).where(LeaveRequest.status == "pending")
        )
    ).scalar() or 0
    retention = round((active_emp / total_emp * 100) if total_emp else 0, 1)

    messages = [
        {
            "role": "system",
            "content": "You are an HR analytics expert. Always respond with valid JSON only — no markdown.",
        },
        {
            "role": "user",
            "content": f"""Generate 3-4 actionable HR insights from this workforce data.

Data:
- Total Employees: {total_emp}
- Active Employees: {active_emp}
- Retention Rate: {retention}%
- Pending Leave Requests: {pending_leaves}

Return ONLY this JSON:
{{
  "insights": [
    {{
      "title": "<short title, max 6 words>",
      "description": "<2 sentences with specific observations>",
      "type": "positive | warning | neutral",
      "action": "<concrete recommended action>"
    }}
  ]
}}""",
        },
    ]

    try:
        client = get_groq_client()
        result_text = _chat(client, messages, model=GROQ_MODEL_FAST,
                            temperature=0.5, max_tokens=600, json_mode=True)
        insights = json.loads(result_text)
    except Exception:
        # Graceful fallback — never crash the dashboard
        insights = {
            "insights": [
                {
                    "title": "Workforce Health",
                    "description": (
                        f"You have {active_emp} active employees out of {total_emp} total, "
                        f"with a {retention}% retention rate."
                    ),
                    "type": "positive" if retention >= 90 else "neutral",
                    "action": "Review workforce planning each quarter.",
                },
                {
                    "title": "Pending Leave Requests",
                    "description": (
                        f"There are {pending_leaves} leave requests awaiting approval. "
                        "Timely processing improves employee satisfaction."
                    ),
                    "type": "warning" if pending_leaves > 5 else "neutral",
                    "action": "Review and process all pending leave requests within 24 hours.",
                },
            ]
        }

    return insights


# ─── 6. Voice Interview Evaluation ───────────────────────────────────────────

@router.post("/voice-interview")
async def evaluate_voice_interview(
    payload: dict = Body(...),
    current_user: User = Depends(require_hr),
):
    """
    Evaluate a voice interview transcript for recruitment screening.
    Payload:
      transcript     (str)  — spoken text transcribed by the browser (Web Speech API)
      candidate_name (str)  — candidate's name
      job_title      (str)  — position being interviewed for
      questions      (list) — optional: list of interview questions asked
    Returns structured AI assessment saved to MongoDB.
    """
    transcript     = payload.get("transcript", "").strip()
    candidate_name = payload.get("candidate_name", "Candidate")
    job_title      = payload.get("job_title", "the position")
    questions      = payload.get("questions", [])

    if not transcript:
        raise HTTPException(
            status_code=400,
            detail="Transcript is required. Please record your voice answer first."
        )
    if len(transcript) < 30:
        raise HTTPException(
            status_code=400,
            detail="Transcript is too short. Please provide a more detailed answer."
        )

    questions_text = "\n".join([f"Q{i+1}: {q}" for i, q in enumerate(questions)]) if questions else "General interview"

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert HR interviewer. Evaluate candidate interview responses "
                "and always respond with valid JSON only — no markdown or extra text."
            ),
        },
        {
            "role": "user",
            "content": f"""Evaluate this voice interview response for a {job_title} position.

Candidate: {candidate_name}
Interview Questions: {questions_text}

Candidate's Response (transcribed from voice):
\"\"\"{transcript}\"\"\"

Return ONLY this JSON:
{{
  "score": <integer 0-100>,
  "communication_score": <integer 0-100>,
  "confidence_score": <integer 0-100>,
  "key_strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "concerns": ["<concern1>", "<concern2>"],
  "recommendation": "<one of: Strong Hire | Hire | Maybe | Reject>",
  "summary": "<2-3 sentence professional assessment>",
  "next_steps": "<specific recommended next step>"
}}""",
        },
    ]

    try:
        client = get_groq_client()
        result_text = _chat(client, messages, model=GROQ_MODEL, temperature=0.2,
                            max_tokens=1000, json_mode=True)
        assessment = json.loads(result_text)
    except json.JSONDecodeError:
        try:
            assessment = _extract_json(result_text)
        except Exception:
            raise HTTPException(
                status_code=500,
                detail="Failed to parse AI assessment response. Please retry."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Groq API error: {str(e)}")

    # Ensure required keys
    defaults = {
        "score": 50, "communication_score": 50, "confidence_score": 50,
        "key_strengths": [], "concerns": [], "recommendation": "Maybe",
        "summary": "Assessment could not be completed.", "next_steps": "Review manually.",
    }
    for k, v in defaults.items():
        if k not in assessment:
            assessment[k] = v

    # Save to MongoDB
    mongo_db = get_mongo_db()
    document = {
        "candidate_name": candidate_name,
        "job_title": job_title,
        "transcript": transcript,
        "questions": questions,
        "interview_type": "voice",
        "created_at": datetime.now(timezone.utc),
        **assessment,
    }
    result = await mongo_db.voice_interviews.insert_one(document)
    assessment["_id"] = str(result.inserted_id)

    await _log_ai_call(
        "voice_interview",
        f"Candidate: {candidate_name} for {job_title}",
        f"Score: {assessment.get('score')}, Rec: {assessment.get('recommendation')}",
    )

    return assessment


@router.post("/voice-interview/start")
async def start_voice_interview(
    candidate_name: str = Form("Candidate"),
    job_title: str = Form("the position"),
    jd_text: str = Form(""),
    resume_file: UploadFile | None = File(None),
    current_user: User = Depends(require_hr),
):
    """
    Start a dynamic voice interview session. Generates the first question, optionally incorporating candidate's resume context.
    """
    resume_text = ""
    if resume_file:
        if not resume_file.filename.endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are supported for resume screening."
            )
        try:
            pdf_bytes = await resume_file.read()
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            for page in doc:
                resume_text += page.get_text()
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse PDF resume file: {str(e)}"
            )

    resume_context = f"\nCandidate's Resume:\n{resume_text}" if resume_text else ""

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert HR interviewer conducting a friendly but professional interview. "
                "You need to ask questions one by one. Keep questions short, conversational, and direct. "
                "Output ONLY the question text itself, with no introductory text (like 'Sure, here is your question:') or formatting."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Welcome candidate {candidate_name} and ask the first general/warmup interview question for the position of {job_title}. "
                f"Use this Job Description to frame your question: {jd_text}."
                f"{resume_context}"
                "\nAsk a question that relates to their profile/experience on their resume or why they are a good fit for this role."
            ),
        },
    ]

    try:
        client = get_groq_client()
        result_text = _chat(client, messages, model=GROQ_MODEL, temperature=0.7, max_tokens=150)
        question = result_text.strip().replace('"', '')
    except Exception:
        question = f"Hello {candidate_name}, thank you for coming today. To start, could you please tell me about yourself and your background?"

    return {"question": question, "resume_text": resume_text}


@router.post("/voice-interview/next")
async def next_voice_interview(
    payload: dict = Body(...),
    current_user: User = Depends(require_hr),
):
    """
    Process candidate's answer. Generates the next question or returns the final assessment.
    """
    candidate_name = payload.get("candidate_name", "Candidate")
    job_title = payload.get("job_title", "the position")
    jd_text = payload.get("jd_text", "").strip() or f"Position: {job_title}"
    history = payload.get("history", [])
    current_question = payload.get("current_question", "")
    candidate_answer = payload.get("candidate_answer", "").strip()
    resume_text = payload.get("resume_text", "").strip()

    # Append current turn to history
    all_turns = list(history)
    if current_question and candidate_answer:
        all_turns.append({"question": current_question, "answer": candidate_answer})

    # Target 5 questions total
    if len(all_turns) >= 5:
        transcript_parts = []
        for i, turn in enumerate(all_turns):
            transcript_parts.append(f"Q{i+1}: {turn['question']}\nAnswer: {turn['answer']}")
        full_transcript = "\n\n".join(transcript_parts)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert HR interviewer. Evaluate candidate interview responses "
                    "and always respond with valid JSON only — no markdown or extra text."
                ),
            },
            {
                "role": "user",
                "content": f"""Evaluate this voice interview response for a {job_title} position.

Candidate: {candidate_name}
{"Candidate's Resume Context:" if resume_text else ""}
{resume_text if resume_text else ""}

Interview Transcript:
\"\"\"{full_transcript}\"\"\"

Return ONLY this JSON:
{{
  "score": <integer 0-100>,
  "communication_score": <integer 0-100>,
  "confidence_score": <integer 0-100>,
  "key_strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "concerns": ["<concern1>", "<concern2>"],
  "recommendation": "<one of: Strong Hire | Hire | Maybe | Reject>",
  "summary": "<2-3 sentence professional assessment>",
  "next_steps": "<specific recommended next step>"
}}""",
            },
        ]

        try:
            client = get_groq_client()
            result_text = _chat(client, messages, model=GROQ_MODEL, temperature=0.2,
                                max_tokens=1000, json_mode=True)
            assessment = json.loads(result_text)
        except json.JSONDecodeError:
            try:
                assessment = _extract_json(result_text)
            except Exception:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to parse AI assessment response. Please retry."
                )
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Groq API error: {str(e)}")

        defaults = {
            "score": 50, "communication_score": 50, "confidence_score": 50,
            "key_strengths": [], "concerns": [], "recommendation": "Maybe",
            "summary": "Assessment could not be completed.", "next_steps": "Review manually.",
        }
        for k, v in defaults.items():
            if k not in assessment:
                assessment[k] = v

        mongo_db = get_mongo_db()
        document = {
            "candidate_name": candidate_name,
            "job_title": job_title,
            "transcript": full_transcript,
            "questions": [turn["question"] for turn in all_turns],
            "interview_type": "voice",
            "created_at": datetime.now(timezone.utc),
            **assessment,
        }
        result = await mongo_db.voice_interviews.insert_one(document)
        assessment["_id"] = str(result.inserted_id)

        await _log_ai_call(
            "voice_interview",
            f"Candidate: {candidate_name} for {job_title}",
            f"Final dynamic interview evaluation. Score: {assessment.get('score')}",
        )

        return {
            "is_complete": True,
            "assessment": assessment,
            "history": all_turns
        }

    else:
        transcript_history = ""
        for i, turn in enumerate(all_turns):
            transcript_history += f"Q{i+1}: {turn['question']}\nAnswer: {turn['answer']}\n\n"

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert HR interviewer conducting a friendly but professional voice interview. "
                    "You need to generate the next logical follow-up question based on the job description, candidate's resume context, and the conversation history. "
                    "Keep questions short, conversational, and direct. "
                    "Output ONLY the question text itself, with no introductory text or formatting."
                ),
            },
            {
                "role": "user",
                "content": f"""We are conducting an interview with {candidate_name} for the position of {job_title}.
Job Description: {jd_text}
{"Candidate's Resume Context:" if resume_text else ""}
{resume_text if resume_text else ""}

Here is the transcript of the interview so far:
{transcript_history}
Generate the next follow-up question. Address the candidate's last response if appropriate or guide the discussion to another key criteria of the job or details from their resume.
""",
            },
        ]

        try:
            client = get_groq_client()
            result_text = _chat(client, messages, model=GROQ_MODEL, temperature=0.7, max_tokens=150)
            next_question = result_text.strip().replace('"', '')
        except Exception:
            fallbacks = [
                "Could you describe a challenging project you worked on and how you handled it?",
                "What are your greatest strengths and areas for improvement?",
                "Why are you interested in this position with our company?",
                "Where do you see yourself professionally in the next five years?",
            ]
            next_question = fallbacks[len(all_turns) - 1] if len(all_turns) - 1 < len(fallbacks) else "Thank you. Can you tell me why you are the best fit for this role?"

        return {
            "is_complete": False,
            "next_question": next_question,
            "history": all_turns
        }


@router.get("/voice-interviews")
async def list_voice_interviews(
    _: User = Depends(require_hr),
):
    """List all voice interview assessments from MongoDB."""
    mongo_db = get_mongo_db()
    cursor = mongo_db.voice_interviews.find(
        {}, {"transcript": 0}  # exclude full transcript for list view
    ).sort("created_at", -1).limit(50)
    docs = await cursor.to_list(length=50)
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
    return docs


# ─── 7. Video Interview Evaluation ───────────────────────────────────────────

@router.post("/video-interview")
async def evaluate_video_interview(
    video_file: UploadFile = File(...),
    candidate_name: str = Form(...),
    job_title: str = Form(...),
    jd_text: str = Form(...),
    question_text: str = Form("Describe yourself and your experience."),
    _: User = Depends(require_hr),
):
    """
    Evaluate a recorded video response transcript.
    Saves candidate video locally and evaluates speech contents using Groq Whisper + Llama 3.
    """
    ext = video_file.filename.split(".")[-1].lower()
    if ext not in ["webm", "mp4", "mpeg", "wav", "avi", "mov", "ogg"]:
        raise HTTPException(
            status_code=400,
            detail="Only standard audio/video formats are supported (webm, mp4, etc.)."
        )

    # 1. Save video file to static directory
    session_id = uuid.uuid4().hex
    filename = f"{session_id}.{ext}"
    upload_dir = os.path.join("uploads", "video_interviews")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)

    try:
        content = await video_file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save video response: {str(e)}"
        )

    # 2. Call Groq Whisper API for speech-to-text
    client = get_groq_client()
    try:
        content_type = video_file.content_type or f"video/{ext}"
        
        # Whisper model requires file tuple: (filename, bytes, content_type)
        transcription = await asyncio.to_thread(
            client.audio.transcriptions.create,
            file=(filename, content, content_type),
            model="whisper-large-v3",
            response_format="json"
        )
        transcript = transcription.text
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=503,
            detail=f"Groq speech translation failed: {str(e)}"
        )

    if not transcript or not transcript.strip():
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=400,
            detail="No spoken audio could be detected in the video file."
        )

    # 3. Analyze transcript text against JD using Groq Llama 3
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert HR interviewer. Evaluate candidate video response transcripts "
                "and always respond with valid JSON only — no markdown or extra conversational text."
            ),
        },
        {
            "role": "user",
            "content": f"""Evaluate this video interview response transcript for a {job_title} position.

Job Description:
{jd_text}

Interview Question Asked:
{question_text}

Candidate's Response:
\"\"\"{transcript}\"\"\"

Return ONLY this JSON structure:
{{
  "score": <integer 0-100>,
  "communication_score": <integer 0-100>,
  "confidence_score": <integer 0-100>,
  "key_strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "concerns": ["<concern1>", "<concern2>"],
  "recommendation": "<one of: Strong Hire | Hire | Maybe | Reject>",
  "summary": "<2-3 sentence professional assessment>",
  "next_steps": "<specific recommended next step>"
}}""",
        },
    ]

    try:
        result_text = await asyncio.to_thread(
            _chat, client, messages, model=GROQ_MODEL, temperature=0.2,
            max_tokens=1000, json_mode=True
        )
        assessment = json.loads(result_text)
    except json.JSONDecodeError:
        try:
            assessment = _extract_json(result_text)
        except Exception:
            raise HTTPException(
                status_code=500,
                detail="Failed to parse AI evaluation response. Please retry."
            )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Groq API error: {str(e)}")

    # Ensure required keys exist
    defaults = {
        "score": 50, "communication_score": 50, "confidence_score": 50,
        "key_strengths": [], "concerns": [], "recommendation": "Maybe",
        "summary": "Assessment could not be completed.", "next_steps": "Review manually.",
    }
    for k, v in defaults.items():
        if k not in assessment:
            assessment[k] = v

    # Save to MongoDB
    mongo_db = get_mongo_db()
    video_url = f"/uploads/video_interviews/{filename}"
    document = {
        "candidate_name": candidate_name,
        "job_title": job_title,
        "video_url": video_url,
        "transcript": transcript,
        "question": question_text,
        "interview_type": "video",
        "created_at": datetime.now(timezone.utc),
        **assessment,
    }
    result = await mongo_db.video_interviews.insert_one(document)
    assessment["_id"] = str(result.inserted_id)
    assessment["video_url"] = video_url
    assessment["transcript"] = transcript

    await _log_ai_call(
        "video_interview",
        f"Candidate: {candidate_name} for {job_title}",
        f"Score: {assessment.get('score')}, Rec: {assessment.get('recommendation')}",
    )

    return assessment


@router.get("/video-interviews")
async def list_video_interviews(
    _: User = Depends(require_hr),
):
    """List all video interview assessments from MongoDB."""
    mongo_db = get_mongo_db()
    cursor = mongo_db.video_interviews.find(
        {}, {"transcript": 0}  # exclude transcript for list view
    ).sort("created_at", -1).limit(50)
    docs = await cursor.to_list(length=50)
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        if "created_at" in doc:
            doc["created_at"] = doc["created_at"].isoformat()
    return docs
