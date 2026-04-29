"""
LLM service using Ollama (free, local) with LLaMA 3.2 (or any model).
Falls back gracefully if Ollama is not running.
"""
import json
import re
import httpx
from app.core.config import settings


OLLAMA_URL = f"{settings.OLLAMA_BASE_URL}/api/generate"


async def _call_ollama(prompt: str, system: str = "") -> str:
    """Raw async call to Ollama generate endpoint."""
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "top_p": 0.9,
            "num_predict": 800,
        },
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(OLLAMA_URL, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "").strip()


async def check_ollama_available() -> bool:
    """Ping Ollama health endpoint."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


async def generate_candidate_summary(
    resume_text: str,
    job_description: str,
    candidate_id: str = "unknown",
    similarity_score: float = 0.0,
) -> dict:
    """
    Use LLaMA (via Ollama) to generate a structured candidate assessment.
    Returns dict with: summary, strengths, gaps, recommendation, fit_score.
    Falls back to rule-based analysis if Ollama is unavailable.
    """
    system = (
        "You are an expert HR assistant and technical recruiter. "
        "Analyse resumes against job descriptions objectively and concisely. "
        "Always respond with ONLY valid JSON, no markdown, no extra text."
    )

    prompt = f"""Analyse this candidate for the job role.

JOB DESCRIPTION (first 1500 chars):
{job_description[:1500]}

CANDIDATE RESUME (first 1500 chars):
{resume_text[:1500]}

Vector Similarity Score: {similarity_score:.2%}

Respond with ONLY this JSON (no markdown, no backticks):
{{
  "summary": "2-3 sentence overview of the candidate fit",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "gaps": ["gap 1", "gap 2"],
  "recommendation": "Strong Match|Good Match|Partial Match|Poor Match",
  "fit_score": <number 0-100>
}}"""

    try:
        raw = await _call_ollama(prompt, system)
        # Extract JSON from response
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            return {
                "candidate_id": candidate_id,
                "summary": data.get("summary", ""),
                "strengths": data.get("strengths", []),
                "gaps": data.get("gaps", []),
                "recommendation": data.get("recommendation", "Partial Match"),
                "fit_score": float(data.get("fit_score", similarity_score * 100)),
            }
    except Exception as e:
        print(f"[LLM] Ollama call failed: {e}")

    # ── Fallback: rule-based summary ──────────────────────────────────────
    return _fallback_summary(resume_text, job_description, candidate_id, similarity_score)


def _fallback_summary(
    resume_text: str,
    job_description: str,
    candidate_id: str,
    score: float,
) -> dict:
    """Rule-based fallback when Ollama is not available."""
    fit_score = round(score * 100, 1)

    if score >= 0.75:
        recommendation = "Strong Match"
        summary = "The candidate's profile closely aligns with the job requirements based on semantic similarity analysis."
    elif score >= 0.55:
        recommendation = "Good Match"
        summary = "The candidate shows good alignment with several key requirements of the role."
    elif score >= 0.35:
        recommendation = "Partial Match"
        summary = "The candidate has some relevant skills but may not meet all core requirements."
    else:
        recommendation = "Poor Match"
        summary = "The candidate's profile shows limited alignment with the job description."

    # Simple keyword overlap for strengths/gaps
    resume_words = set(resume_text.lower().split())
    jd_words = set(job_description.lower().split())
    overlap = resume_words & jd_words
    
    strengths = [f"Relevant keyword match ({len(overlap)} common terms)"]
    gaps = ["Full LLM analysis unavailable (Ollama not running)"]

    return {
        "candidate_id": candidate_id,
        "summary": summary,
        "strengths": strengths,
        "gaps": gaps,
        "recommendation": recommendation,
        "fit_score": fit_score,
    }


async def analyze_resume_for_roles(resume_text: str) -> dict:
    """
    Use LLaMA to deeply analyze a resume: extract skills, experience level,
    and suggest the best-fit job roles with reasoning.
    Returns structured dict for the ResumeAnalysis schema.
    """
    system = (
        "You are a senior recruiter and career advisor with 20 years of experience. "
        "Analyze resumes objectively and return ONLY valid JSON, no markdown, no extra text."
    )

    prompt = f"""Analyze this resume and respond with ONLY this JSON structure:
{{
  "candidate_name": "Full name from resume or 'Candidate' if not found",
  "summary": "2-3 sentence professional summary of this person",
  "top_skills": ["skill1", "skill2", "skill3", "skill4", "skill5", "skill6"],
  "experience_level": "Junior|Mid-level|Senior|Lead|Executive",
  "suggested_roles": [
    {{"role": "Job Title 1", "match_reason": "Why this role fits", "fit_level": "Excellent"}},
    {{"role": "Job Title 2", "match_reason": "Why this role fits", "fit_level": "Good"}},
    {{"role": "Job Title 3", "match_reason": "Why this role fits", "fit_level": "Fair"}}
  ],
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "areas_to_improve": ["area 1", "area 2"]
}}

RESUME (first 2000 chars):
{resume_text[:2000]}"""

    try:
        raw = await _call_ollama(prompt, system)
        import json, re
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            # Normalise fit_level values
            for r in data.get("suggested_roles", []):
                if r.get("fit_level") not in ("Excellent", "Good", "Fair"):
                    r["fit_level"] = "Good"
            return data
    except Exception as e:
        print(f"[LLM] analyze_resume failed: {e}")

    return _fallback_role_analysis(resume_text)


def _fallback_role_analysis(text: str) -> dict:
    """Rule-based fallback when Ollama is not running."""
    words = text.lower()
    skills = []
    role_map = {
        "python": ("Python Developer", "Strong Python skills detected"),
        "machine learning": ("ML Engineer", "Machine learning experience found"),
        "data": ("Data Analyst", "Data-related skills identified"),
        "react": ("Frontend Developer", "React/frontend skills present"),
        "java": ("Java Developer", "Java experience detected"),
        "sql": ("Database Administrator", "SQL and database skills found"),
        "aws": ("Cloud Engineer", "Cloud platform experience detected"),
        "project manag": ("Project Manager", "Project management keywords found"),
    }
    skill_kw = ["python","java","javascript","react","sql","aws","docker","kubernetes","machine learning","nlp","data science","typescript","node","django","fastapi"]
    for sk in skill_kw:
        if sk in words:
            skills.append(sk)

    suggested = []
    for kw, (role, reason) in role_map.items():
        if kw in words:
            suggested.append({"role": role, "match_reason": reason, "fit_level": "Good" if len(suggested) > 0 else "Excellent"})
        if len(suggested) >= 3:
            break

    if not suggested:
        suggested = [{"role": "General Professional", "match_reason": "Based on profile content", "fit_level": "Fair"}]

    return {
        "candidate_name": "Candidate",
        "summary": "This candidate has a relevant professional background. Full AI analysis requires Ollama to be running locally.",
        "top_skills": skills[:6] or ["Professional skills detected"],
        "experience_level": "Mid-level",
        "suggested_roles": suggested,
        "strengths": ["Professional experience present", "Relevant qualifications identified"],
        "areas_to_improve": ["Full analysis unavailable — start Ollama for detailed insights"],
    }
