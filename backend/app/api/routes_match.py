"""
Matching & AI summary routes.
"""
from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    JobDescriptionInput,
    MatchResponse,
    SummaryRequest,
    SummaryResponse,
    StatsResponse,
)
from app.services.matching_engine import match_resumes_to_job, match_jobs_to_resume
from app.services.llm_service import generate_candidate_summary, check_ollama_available
from app.services.vector_store import get_vector_store
from app.core.config import settings

router = APIRouter()


@router.post("/resumes", response_model=MatchResponse)
async def find_matching_resumes(body: JobDescriptionInput):
    try:
        matches = match_resumes_to_job(body.description, top_k=body.top_k)
        return MatchResponse(job_title=body.title, matches=matches, total_found=len(matches))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/summary")
async def get_candidate_summary(body: SummaryRequest):
    """
    Match a resume against a job description — returns strengths, gaps,
    interview questions, and a hiring recommendation.
    """
    try:
        result = await generate_candidate_summary(
            resume_text=body.resume_text,
            job_description=body.job_description,
            candidate_id=body.candidate_id or "unknown",
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_resume(body: dict):
    """
    Deep standalone resume analysis via LLaMA:
    skills, experience level, gaps, role suggestions, resume quality, next steps.
    """
    from app.services.llm_service import analyze_resume_for_roles
    from app.services.text_cleaner import clean_pdf_text

    resume_text = body.get("resume_text", "")
    if not resume_text.strip():
        raise HTTPException(status_code=422, detail="resume_text is required")

    # Always clean the text before sending to LLM
    resume_text = clean_pdf_text(resume_text)

    try:
        result = await analyze_resume_for_roles(resume_text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    store = get_vector_store()
    counts = store.get_collection_stats()
    llm_ok = await check_ollama_available()
    return StatsResponse(
        resumes_indexed=counts["resumes"],
        jobs_indexed=counts["jobs"],
        embedding_model=settings.EMBEDDING_MODEL,
        llm_model=settings.OLLAMA_MODEL,
        llm_available=llm_ok,
    )
