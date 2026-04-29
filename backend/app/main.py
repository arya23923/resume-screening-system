from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_auth import router as auth_router
from app.api.routes_ingest import router as ingest_router
from app.api.routes_match import router as match_router
from app.api.routes_shortlist import router as shortlist_router

app = FastAPI(
    title="AI Resume Screening System",
    version="1.0.0",
    description=(
        "NLP + Vector DB powered resume screening. "
        "Matches resumes to job descriptions using sentence-transformer embeddings "
        "stored in ChromaDB, with LLaMA (Ollama) for AI summaries."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
def root():
    return {
        "message": "AI Resume Screening API 🚀",
        "docs": "/docs",
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(ingest_router, prefix="/ingest", tags=["Ingest"])
app.include_router(match_router, prefix="/match", tags=["Matching"])
app.include_router(shortlist_router, prefix="/shortlist", tags=["Shortlist"])
