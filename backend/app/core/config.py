from pathlib import Path

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

# IMPORTANT: Chroma needs string path
VECTOR_DB_DIR = str(VECTOR_DB_PATH)

# Create folders automatically if missing
RESUME_DIR.mkdir(parents=True, exist_ok=True)
JOB_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)