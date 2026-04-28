from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.services.matching_engine import match_resume_to_jobs, match_job_to_resumes

router = APIRouter()

# Request/Response models
class MatchRequest(BaseModel):
    resume_id: str
    top_k: Optional[int] = 5

class JobMatchRequest(BaseModel):
    job_id: str
    top_k: Optional[int] = 5

class MatchItem(BaseModel):
    job_id: str
    similarity_score: float
    rank: int

class JobMatchItem(BaseModel):
    resume_id: str
    similarity_score: float
    rank: int

class MatchResponse(BaseModel):
    status: str
    data: dict
    metadata: dict

@router.post("/resume-to-jobs")
async def resume_to_jobs(request: MatchRequest):
    """Match a resume against all jobs"""
    try:
        matches = match_resume_to_jobs(request.resume_id, request.top_k)
        
        return {
            "status": "success",
            "data": {
                "matches": matches
            },
            "metadata": {
                "resume_id": request.resume_id,
                "total_matches": len(matches),
                "top_k": request.top_k
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/job-to-resumes")
async def job_to_resumes(request: JobMatchRequest):
    """Match a job against all resumes"""
    try:
        matches = match_job_to_resumes(request.job_id, request.top_k)
        
        return {
            "status": "success",
            "data": {
                "matches": matches
            },
            "metadata": {
                "job_id": request.job_id,
                "total_matches": len(matches),
                "top_k": request.top_k
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/score/{resume_id}/{job_id}")
async def get_match_score(resume_id: str, job_id: str):
    """Get similarity score between a specific resume and job"""
    try:
        # Get matches for this resume
        matches = match_resume_to_jobs(resume_id, top_k=100)
        
        # Find the specific job
        for match in matches:
            if match['job_id'] == job_id:
                return {
                    "resume_id": resume_id,
                    "job_id": job_id,
                    "similarity_score": match['similarity_score'],
                    "match_percentage": f"{match['similarity_score'] * 100:.1f}%"
                }
        
        raise HTTPException(status_code=404, detail="Match not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))