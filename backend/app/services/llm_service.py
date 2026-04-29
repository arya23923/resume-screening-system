"""
LLM service — Groq Cloud (free tier) with LLaMA 3.
Provides:
  1. analyze_resume_for_roles  — deep resume analysis
  2. generate_candidate_summary — job matching
Includes safe fallback logic when API is unavailable.
"""

import json
import re
import httpx
from app.core.config import settings
from app.services.text_cleaner import clean_pdf_text

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


# ─────────────────────────────────────────────
# GROQ CALL
# ─────────────────────────────────────────────

async def _call_groq(prompt: str, system: str = "", max_tokens: int = 1200) -> str:
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.4,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(GROQ_API_URL, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()


def _safe_json(raw: str):
    try:
        return json.loads(raw)
    except:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except:
                pass
    return None


def _prepare(text: str, max_chars=3000):
    cleaned = clean_pdf_text(text)
    return cleaned[:max_chars]


# ─────────────────────────────────────────────
# 1. RESUME ANALYSIS
# ─────────────────────────────────────────────

async def analyze_resume_for_roles(resume_text: str) -> dict:
    resume = _prepare(resume_text)

    system = """You are a senior recruiter.
Return ONLY valid JSON. No markdown."""

    prompt = f"""
Analyze this resume:

{resume}

Return JSON:
{{
  "candidate_name": "",
  "experience_level": "",
  "years_experience": "",
  "current_role": "",
  "summary": "",
  "top_skills": [],
  "skill_gaps": [],
  "strengths": [],
  "improvements": [],
  "suggested_roles": [
    {{"role": "", "reason": "", "fit": ""}}
  ],
  "resume_score": {{"score": 0, "comment": ""}},
  "next_steps": []
}}
"""

    try:
        raw = await _call_groq(prompt, system)
        data = _safe_json(raw)
        if data:
            return data
    except:
        pass

    return {
        "candidate_name": "Candidate",
        "experience_level": "Unknown",
        "years_experience": "Unknown",
        "current_role": "Unknown",
        "summary": "AI unavailable — fallback analysis used.",
        "top_skills": [],
        "skill_gaps": [],
        "strengths": [],
        "improvements": [],
        "suggested_roles": [],
        "resume_score": {"score": 5, "comment": "Fallback mode"},
        "next_steps": ["Set GROQ_API_KEY in .env"]
    }


# ─────────────────────────────────────────────
# 2. JOB MATCHING
# ─────────────────────────────────────────────

async def generate_candidate_summary(
    resume_text: str,
    job_description: str,
    candidate_id: str = "unknown",
    similarity_score: float = 0.0,
) -> dict:

    resume = _prepare(resume_text, 2000)
    jd = clean_pdf_text(job_description)[:2000]

    system = """You are a senior technical recruiter.
Return ONLY valid JSON."""

    prompt = f"""
Compare resume with job description objectively.

JOB DESCRIPTION:
{jd}

RESUME:
{resume}

Similarity score: {similarity_score}

Return JSON:
{{
  "summary": "",
  "strengths": [],
  "gaps": [],
  "recommendation": "Strong Match|Good Match|Partial Match|Poor Match",
  "fit_score": 0,
  "interview_questions": [],
  "hiring_advice": ""
}}
"""

    try:
        raw = await _call_groq(prompt, system, 1000)
        data = _safe_json(raw)

        if data:
            return {
                "candidate_id": candidate_id,
                "summary": data.get("summary", ""),
                "strengths": data.get("strengths", []),
                "gaps": data.get("gaps", []),
                "recommendation": data.get("recommendation", "Partial Match"),
                "fit_score": float(data.get("fit_score", similarity_score * 100)),
                "interview_questions": data.get("interview_questions", []),
                "hiring_advice": data.get("hiring_advice", ""),
            }

    except:
        pass

    # fallback
    score = round(similarity_score * 100, 1)

    return {
        "candidate_id": candidate_id,
        "summary": "Fallback analysis (LLM unavailable).",
        "strengths": ["Basic keyword overlap detected"],
        "gaps": ["Requires LLM for deep analysis"],
        "recommendation": "Good Match" if score > 60 else "Partial Match",
        "fit_score": score,
        "interview_questions": [],
        "hiring_advice": "Enable GROQ_API_KEY for full analysis",
    }