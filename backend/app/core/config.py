from pathlib import Path
import os
<<<<<<< HEAD
=======
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
>>>>>>> 5cd046b (updated project now)
from pydantic_settings import BaseSettings

# Base project directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Data directories
DATA_DIR = BASE_DIR / "data"
RESUME_DIR = DATA_DIR / "resumes_raw"
JOB_DIR = DATA_DIR / "jobs_raw"
PROCESSED_DIR = DATA_DIR / "processed"

# Vector DB directory (Chroma persistence)
VECTOR_DB_PATH = BASE_DIR / "vector_db"
VECTOR_DB_PATH.mkdir(parents=True, exist_ok=True)
VECTOR_DB_DIR = str(VECTOR_DB_PATH)

# Create folders automatically if missing
RESUME_DIR.mkdir(parents=True, exist_ok=True)
JOB_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    # App
    APP_NAME: str = "AI Resume Screening System"
    DEBUG: bool = False

    # JWT Auth
    SECRET_KEY = "your-super-secret-jwt-key-change-in-production-32chars"
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    OLLAMA_MODEL = "llama3-70b-8192 (Groq)"
    EMBEDDING_MODEL = "all-MiniLM-L6-v2"

    # Matching defaults
    DEFAULT_TOP_K: int = 10

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
