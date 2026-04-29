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

    prompt = f"""Analyse this candidate for the job role objectively.
Do not output placeholders like 'strength 1'. Provide real, specific analysis.

JOB DESCRIPTION (first 3000 chars):
{job_description[:3000]}

CANDIDATE RESUME (first 3000 chars):
{resume_text[:3000]}

Vector Similarity Score: {similarity_score:.2%}

Respond with ONLY this JSON structure (no markdown, no backticks, no extra text):
{{
  "summary": "Provide a thorough 3-4 sentence overview of the candidate's fit for the job.",
  "strengths": ["Specific relevant strength identified from their work", "Another specific strength", "A third specific strength"],
  "gaps": ["Specific missing skill or gap in experience compared to the JD", "Another realistic gap"],
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
    
    strengths = [f"Strong overlap with required keywords ({len(overlap)} exact matches)", "Demonstrates baseline qualifications for the target domain"]
    gaps = ["Consider evaluating soft skills and detailed project impact manually", "Technical depth requires technical interview verification"]

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

    prompt = f"""Analyze this resume deeply and extract the key information.
Ensure you respond with ONLY valid JSON and no other text.
Do not use placeholder text like 'area 1' or 'skill 1'. You must generate real, specific insights based on the resume content.

{{
  "candidate_name": "Extract the full name from the resume. If not found, output 'Candidate'",
  "summary": "Write a detailed 3-4 sentence professional summary of this person's background, highlighting their core expertise and industry.",
  "top_skills": ["List actual skill 1", "List actual skill 2", "List actual skill 3", "List actual skill 4", "List actual skill 5"],
  "experience_level": "Choose one: Junior, Mid-level, Senior, Lead, or Executive",
  "suggested_roles": [
    {{"role": "Specific Job Title 1", "match_reason": "Specific reason why based on their experience", "fit_level": "Excellent"}},
    {{"role": "Specific Job Title 2", "match_reason": "Specific reason why based on their experience", "fit_level": "Good"}},
    {{"role": "Specific Job Title 3", "match_reason": "Specific reason why based on their experience", "fit_level": "Fair"}}
  ],
  "strengths": ["Specific strength identified from their work", "Another specific strength", "A third specific strength"],
  "areas_to_improve": ["Specific gap in their experience or missing common skill", "Another realistic area for professional development"]
}}

RESUME TEXT TO ANALYZE (first 4000 chars):
{resume_text[:4000]}"""

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
        "candidate_name": "Candidate Profile",
        "summary": f"This candidate demonstrates a solid professional background with primary expertise centering around {', '.join(skills[:3]) if skills else 'general technical'} domains. Their keyword profile suggests alignment with mid-level requirements.",
        "top_skills": skills[:6] or ["General technical proficiency", "Communication", "Team collaboration"],
        "experience_level": "Mid-level",
        "suggested_roles": suggested,
        "strengths": ["Clear demonstration of relevant industry skills", "Matches core baseline requirements for standard roles"],
        "areas_to_improve": ["Recommend verifying specific technical depth during interview", "May require onboarding for highly specialized proprietary tools"],
    }
