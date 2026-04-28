from fastapi import FastAPI
from app.services.search import search_resumes

app = FastAPI(title="AI Resume Screening API")

@app.get("/")
def root():
    return {"status": "API running"}

@app.post("/test-search")
def test_search(jd: str):
    return search_resumes(jd)