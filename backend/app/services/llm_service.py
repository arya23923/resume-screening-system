"""
LLM service — Groq Cloud (free tier) with LLaMA 3.
Two modes:
  1. analyze_resume_for_roles  — deep standalone resume analysis
  2. generate_candidate_summary — match a resume against a specific job
Falls back gracefully if Groq is unavailable.
"""
import json
import re
import httpx
from app.core.config import settings
from app.services.text_cleaner import clean_pdf_text

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"  # Replaces deprecated llama3-70b-8192 (removed May 2025)


# ── Low-level Groq API call ────────────────────────────────────────────────────

async def _call_groq(prompt: str, system: str = "", max_tokens: int = 1200) -> str:
    api_key = settings.GROQ_API_KEY
    if not api_key or api_key in ("", "your-groq-api-key-here"):
        raise ValueError(
            "GROQ_API_KEY is not set. Add it to your backend/.env file. "
            "Get a free key at https://console.groq.com"
        )
    headers = {
        "Authorization": f"Bearer {api_key}",
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
        "top_p": 0.9,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(GROQ_API_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


async def check_groq_available() -> bool:
    """Check if Groq API is reachable and key is valid."""
    api_key = settings.GROQ_API_KEY
    if not api_key or api_key in ("", "your-groq-api-key-here"):
        return False
    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
        }
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(GROQ_API_URL, headers=headers, json=payload)
            return r.status_code == 200
    except Exception:
        return False


# Backward-compatible alias so routes_match.py works unchanged
async def check_ollama_available() -> bool:
    return await check_groq_available()


def _safe_json(raw: str) -> dict | None:
    """Extract and parse the first JSON object found in a string."""
    try:
        return json.loads(raw)
    except Exception:
        pass
    block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if block:
        try:
            return json.loads(block.group(1))
        except Exception:
            pass
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return None


# ── Prepare resume text for LLM ────────────────────────────────────────────────

def _prepare_resume(text: str, max_chars: int = 3000) -> str:
    """Clean and truncate resume text before sending to LLM."""
    cleaned = clean_pdf_text(text)
    if len(cleaned) > max_chars:
        cleaned = cleaned[:max_chars] + "\n[... truncated for length ...]"
    return cleaned


# ── 1. Deep standalone resume analysis ────────────────────────────────────────

async def analyze_resume_for_roles(resume_text: str) -> dict:
    """
    Full resume analysis: skills, experience, gaps, role suggestions, actionable advice.
    Uses LLaMA 3 via Groq Cloud. Falls back to rule-based if API unavailable.
    """
    resume_clean = _prepare_resume(resume_text)

    system = """You are an expert career coach and senior technical recruiter with 20+ years of experience.
You analyse resumes honestly and give specific, actionable feedback — not generic platitudes.
You always respond in plain English, never in another language.
You respond ONLY with valid JSON, no markdown, no backticks, no extra text before or after."""

    prompt = f"""Carefully read this resume and give a thorough, honest analysis.

RESUME:
{resume_clean}

Now respond with ONLY this JSON (fill every field, be specific and detailed):
{{
  "candidate_name": "Full name from resume, or 'Candidate' if not found",
  "experience_level": "Fresher|Junior|Mid-level|Senior|Lead|Executive",
  "years_experience": "e.g. 3 years, 7+ years, fresher",
  "current_or_recent_role": "Most recent job title from resume",
  "summary": "Write 3-4 sentences: who this person is professionally, what they have done, what makes them stand out or not, and what kind of role they are ready for. Be honest.",
  "top_skills": ["list 6-8 actual skills mentioned in the resume"],
  "skill_gaps": ["list 2-4 skills that are missing or weak based on their target level"],
  "strongest_points": [
    "Specific strength 1 — reference something concrete from their resume",
    "Specific strength 2 — reference something concrete from their resume",
    "Specific strength 3 — reference something concrete from their resume"
  ],
  "areas_to_improve": [
    "Specific improvement 1 — be direct and actionable",
    "Specific improvement 2 — be direct and actionable",
    "Specific improvement 3 — be direct and actionable"
  ],
  "suggested_roles": [
    {{"role": "Best fit job title", "reason": "Why specifically this role matches their background", "fit": "Excellent"}},
    {{"role": "Second best fit", "reason": "Why this role fits", "fit": "Good"}},
    {{"role": "Stretch role or pivot", "reason": "Why they could grow into this", "fit": "Fair"}}
  ],
  "resume_quality": {{
    "score": <number 1-10>,
    "comment": "1-2 sentences on how well the resume is written and presented"
  }},
  "what_to_do_next": [
    "Actionable next step 1 for this candidate",
    "Actionable next step 2",
    "Actionable next step 3"
  ]
}}"""

    try:
        raw = await _call_groq(prompt, system, max_tokens=1500)
        data = _safe_json(raw)
        if data:
            for r in data.get("suggested_roles", []):
                if r.get("fit") not in ("Excellent", "Good", "Fair"):
                    r["fit"] = "Good"
            return _normalize_analysis(data)
    except Exception as e:
        print(f"[LLM/Groq] analyze_resume_for_roles failed: {e}")

    return _fallback_analysis(resume_text)


def _normalize_analysis(data: dict) -> dict:
    """Ensure all expected keys exist with sane defaults."""
    return {
        "candidate_name":         data.get("candidate_name", "Candidate"),
        "experience_level":       data.get("experience_level", "Unknown"),
        "years_experience":       data.get("years_experience", "Not specified"),
        "current_or_recent_role": data.get("current_or_recent_role", "Not specified"),
        "summary":                data.get("summary", ""),
        "top_skills":             data.get("top_skills", []),
        "skill_gaps":             data.get("skill_gaps", []),
        "strongest_points":       data.get("strongest_points", []),
        "areas_to_improve":       data.get("areas_to_improve", []),
        "suggested_roles":        data.get("suggested_roles", []),
        "resume_quality":         data.get("resume_quality", {"score": 5, "comment": ""}),
        "what_to_do_next":        data.get("what_to_do_next", []),
    }


def _fallback_analysis(text: str) -> dict:
    """Rule-based fallback when Groq API is offline or key is missing."""
    text_lower = text.lower()
    skill_kw = [
        "python", "java", "javascript", "typescript", "react", "node",
        "sql", "aws", "docker", "kubernetes", "machine learning", "nlp",
        "data science", "fastapi", "django", "flask", "tensorflow",
        "pytorch", "excel", "power bi", "tableau", "c++", "go", "rust",
        "project management", "agile", "scrum",
    ]
    found_skills = [sk for sk in skill_kw if sk in text_lower]

    role_map = [
        (["python", "fastapi", "django"], "Backend Python Developer"),
        (["machine learning", "tensorflow", "pytorch"], "ML/AI Engineer"),
        (["data science", "sql", "python"], "Data Scientist"),
        (["react", "javascript", "typescript"], "Frontend Developer"),
        (["aws", "docker", "kubernetes"], "DevOps / Cloud Engineer"),
        (["project management", "agile", "scrum"], "Project Manager"),
        (["java"], "Java Developer"),
        (["sql", "excel", "power bi"], "Data Analyst"),
    ]

    suggested = []
    for keywords, role in role_map:
        if any(k in text_lower for k in keywords):
            fit = "Excellent" if not suggested else ("Good" if len(suggested) < 2 else "Fair")
            reason = f"Skills found: {', '.join(k for k in keywords if k in text_lower)}"
            suggested.append({"role": role, "reason": reason, "fit": fit})
        if len(suggested) >= 3:
            break

    if not suggested:
        suggested = [{"role": "General Professional", "reason": "Profile needs further review", "fit": "Fair"}]

    exp = "Mid-level"
    if any(w in text_lower for w in ["fresher", "graduate", "intern", "entry"]):
        exp = "Junior"
    elif any(w in text_lower for w in ["senior", "lead", "principal", "manager", "director"]):
        exp = "Senior"

    return {
        "candidate_name": "Candidate",
        "experience_level": exp,
        "years_experience": "Not determined",
        "current_or_recent_role": "Not determined",
        "summary": (
            "This candidate has been reviewed using basic keyword analysis because the Groq API "
            "is currently unavailable. Please check your GROQ_API_KEY configuration and try again."
        ),
        "top_skills": found_skills[:8] or ["Skills not detected — ensure resume text is readable"],
        "skill_gaps": ["Full gap analysis requires AI (Groq API unavailable)"],
        "strongest_points": [
            f"Found {len(found_skills)} recognisable technical skills",
            "Resume was successfully uploaded and indexed",
        ],
        "areas_to_improve": [
            "Verify GROQ_API_KEY is set correctly in the .env file",
            "Ensure resume is in plain text or properly formatted PDF",
        ],
        "suggested_roles": suggested,
        "resume_quality": {
            "score": 5,
            "comment": "Quality assessment requires AI analysis (Groq API unavailable).",
        },
        "what_to_do_next": [
            "Check GROQ_API_KEY in your .env file",
            "Get a free API key at https://console.groq.com",
            "Re-upload this resume for a full AI-powered analysis",
        ],
    }


# ── 2. Candidate vs Job matching summary ──────────────────────────────────────

async def generate_candidate_summary(
    resume_text: str,
    job_description: str,
    candidate_id: str = "unknown",
    similarity_score: float = 0.0,
) -> dict:
    """
    Compare a resume to a job description and give a detailed hiring recommendation.
    """
    resume_clean = _prepare_resume(resume_text, max_chars=2000)
    jd_clean = clean_pdf_text(job_description)[:1500]

    system = """You are a senior technical recruiter. 
You compare candidates to job requirements honestly and give specific, evidence-based assessments.
You always write in plain English.
You respond ONLY with valid JSON, no markdown, no extra text."""

    prompt = f"""Compare this candidate's resume to the job description and give a detailed assessment.

JOB DESCRIPTION:
{jd_clean}

CANDIDATE RESUME:
{resume_clean}

Vector similarity score (0-1): {similarity_score:.2f}

Respond with ONLY this JSON:
{{
  "recommendation": "Strong Match|Good Match|Partial Match|Poor Match",
  "fit_score": <integer 0-100>,
  "summary": "3-4 sentences: how well does this candidate fit? Reference specific things from their resume vs the job requirements. Be honest.",
  "strengths": [
    "Specific thing from their resume that matches a job requirement",
    "Another matching point with evidence",
    "Third matching point"
  ],
  "gaps": [
    "Specific requirement from the JD that is missing or weak in their resume",
    "Another gap"
  ],
  "interview_questions": [
    "A targeted interview question to probe a gap or verify a claim",
    "Another useful interview question"
  ],
  "hiring_advice": "1-2 sentences of direct advice to the hiring manager — should they interview this person?"
}}"""

    try:
        raw = await _call_groq(prompt, system, max_tokens=1000)
        data = _safe_json(raw)
        if data:
            rec = data.get("recommendation", "Partial Match")
            if rec not in ("Strong Match", "Good Match", "Partial Match", "Poor Match"):
                rec = "Partial Match"
            return {
                "candidate_id":        candidate_id,
                "summary":             data.get("summary", ""),
                "strengths":           data.get("strengths", []),
                "gaps":                data.get("gaps", []),
                "recommendation":      rec,
                "fit_score":           float(data.get("fit_score", round(similarity_score * 100))),
                "interview_questions": data.get("interview_questions", []),
                "hiring_advice":       data.get("hiring_advice", ""),
            }
    except Exception as e:
        print(f"[LLM/Groq] generate_candidate_summary failed: {e}")

    return _fallback_summary(resume_text, job_description, candidate_id, similarity_score)


def _fallback_summary(resume_text, job_description, candidate_id, score):
    fit = round(score * 100, 1)
    if score >= 0.75:
        rec, msg = "Strong Match", "Strong semantic similarity between resume and job description."
    elif score >= 0.55:
        rec, msg = "Good Match", "Good overlap between candidate profile and job requirements."
    elif score >= 0.35:
        rec, msg = "Partial Match", "Some overlap found. Candidate may meet part of the requirements."
    else:
        rec, msg = "Poor Match", "Low similarity. Candidate likely does not meet key requirements."

    resume_words = set(resume_text.lower().split())
    jd_words = set(job_description.lower().split())
    overlap = len(resume_words & jd_words)

    return {
        "candidate_id":        candidate_id,
        "summary":             f"{msg} AI analysis unavailable (Groq API offline). Similarity score: {fit}%.",
        "strengths":           [f"{overlap} overlapping terms with job description"],
        "gaps":                ["Full gap analysis requires Groq API to be configured"],
        "recommendation":      rec,
        "fit_score":           fit,
        "interview_questions": ["Configure GROQ_API_KEY for AI-generated interview questions"],
        "hiring_advice":       "Set GROQ_API_KEY in your .env for detailed hiring recommendations.",
    }
