from fastapi import APIRouter
from app.services.ingest_resumes import ingest_resumes
from app.services.ingest_jobs import ingest_jobs

router = APIRouter()

@router.post("/resumes")
def ingest_resume_endpoint():
    ingest_resumes()
    return {"message": "Resumes ingested successfully"}

@router.post("/jobs")
def ingest_job_endpoint():
    ingest_jobs()
    return {"message": "Jobs ingested successfully"}