"""
Unified search helpers — thin wrappers used by the API routes.
"""
from app.services.matching_engine import match_resumes_to_job, match_jobs_to_resume
from app.models.schemas import ResumeMatch


def search_resumes_for_job(
    job_description: str,
    top_k: int = 10,
) -> list[ResumeMatch]:
    return match_resumes_to_job(job_description, top_k=top_k)


def search_jobs_for_resume(
    resume_text: str,
    top_k: int = 10,
) -> list[dict]:
    return match_jobs_to_resume(resume_text, top_k=top_k)
