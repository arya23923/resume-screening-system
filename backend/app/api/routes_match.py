from fastapi import APIRouter
from app.services.matching_engine import search_resumes

router = APIRouter()

@router.post("/search")
def match_resumes(query: str):
    results = search_resumes(query)
    return {"results": results}