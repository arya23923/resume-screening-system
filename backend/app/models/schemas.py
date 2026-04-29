from pydantic import BaseModel, Field
from typing import Optional, List, Any

# ─── Auth ───────────────────────────────────────────────
class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    username: Optional[str] = None

# ─── Resume ─────────────────────────────────────────────
class ResumeUpload(BaseModel):
    filename: str
    content: str  # raw text extracted from PDF/doc

class ResumeMatch(BaseModel):
    id: str
    score: float  # cosine similarity 0–1
    category: Optional[str] = None
    preview: Optional[str] = None  # first ~300 chars of resume
    metadata: Optional[dict] = None

# ─── Job Description ────────────────────────────────────
class JobDescriptionInput(BaseModel):
    title: str
    description: str
    top_k: int = Field(default=10, ge=1, le=50)

class MatchResponse(BaseModel):
    job_title: str
    matches: List[ResumeMatch]
    total_found: int

# ─── AI Summary ─────────────────────────────────────────
class SummaryRequest(BaseModel):
    resume_text: str
    job_description: str
    candidate_id: Optional[str] = None

class SummaryResponse(BaseModel):
    candidate_id: Optional[str]
    summary: str
    strengths: List[str]
    gaps: List[str]
    recommendation: str  # "Strong Match" | "Good Match" | "Partial Match" | "Poor Match"
    fit_score: float  # 0-100

# ─── Ingest ─────────────────────────────────────────────
class IngestResponse(BaseModel):
    message: str
    count: int
    errors: List[str] = []
    id: Optional[str] = None
    preview: Optional[str] = None

# ─── Stats ──────────────────────────────────────────────
class StatsResponse(BaseModel):
    resumes_indexed: int
    jobs_indexed: int
    embedding_model: str
    llm_model: str
    llm_available: bool

# ─── Resume Analysis (AI role suggestions) ─────────────
class RoleSuggestion(BaseModel):
    role: str
    match_reason: str
    fit_level: str  # "Excellent" | "Good" | "Fair"

class ResumeAnalysisRequest(BaseModel):
    resume_text: str

class ResumeAnalysisResponse(BaseModel):
    candidate_name: str
    summary: str
    top_skills: List[str]
    experience_level: str
    suggested_roles: List[RoleSuggestion]
    strengths: List[str]
    areas_to_improve: List[str]
