# ⚡ AI-Powered Resume Screening System

A production-ready NLP + Vector DB resume screening system with:
- **Sentence-transformer embeddings** (all-MiniLM-L6-v2, 384d)
- **ChromaDB** for vector similarity search
- **LLaMA 3.2 via Ollama** for free AI summaries (no API key needed)
- **FastAPI** backend with JWT auth
- **React + TypeScript** HR dashboard

---

## 🏗 Architecture

```
Resume PDF / CSV
       │
       ▼
NLP Pipeline (spaCy + NLTK)
  • HTML tag removal
  • Lowercasing + regex clean
  • Stopword removal
  • Lemmatization
       │
       ▼
Sentence Embedding (all-MiniLM-L6-v2)
  384-dim vectors, normalized
       │
       ▼
ChromaDB (cosine similarity, HNSW)
       │
  Query (JD) ──embed──▶ cosine search ──▶ Ranked candidates
                                                │
                                                ▼
                                  LLaMA 3.2 (Ollama) AI Summary
                                  • Strengths / Gaps
                                  • Fit score 0-100
                                  • Recommendation label
```

---

## 🚀 Quick Start

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Optional: copy and edit env
cp .env.example .env

# Download Kaggle datasets and place at:
#   data/resumes_raw/UpdatedResumeDataSet.csv
#     → https://www.kaggle.com/datasets/snehaanbhawal/resume-dataset
#   data/jobs_raw/job_descriptions.csv
#     → https://www.kaggle.com/datasets/ravindrasinghrana/job-description-dataset

# Run the full pipeline (preprocess → embed → index)
python run_pipeline.py

# Start API
uvicorn app.main:app --reload
# API docs: http://localhost:8000/docs
```

### 2. LLaMA (Free AI Summaries)

```bash
# Install Ollama: https://ollama.com
curl -fsSL https://ollama.com/install.sh | sh

# Pull and run LLaMA 3.2 (free, runs locally)
ollama run llama3.2

# The API auto-detects Ollama; falls back gracefully if not running
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
# Login: admin / admin123
```

### 4. Docker (all-in-one)

```bash
docker-compose up --build
```

---

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/token` | Login, get JWT |
| GET | `/match/stats` | Indexed counts, model info |
| POST | `/match/resumes` | Match JD → ranked candidates |
| POST | `/match/summary` | LLaMA AI candidate summary |
| POST | `/ingest/resume/upload` | Upload single PDF |
| POST | `/ingest/resumes/bulk` | Bulk ingest from CSV |
| POST | `/ingest/jobs/bulk` | Bulk ingest jobs CSV |
| POST | `/ingest/prepare` | Run NLP preprocessing pipeline |
| DELETE | `/ingest/reset` | Clear all collections |

---

## 🧩 Key Features

- **Cosine similarity ranking** via ChromaDB HNSW index
- **Batch embedding** with sentence-transformers (CPU-friendly)
- **Upsert** support (re-ingest without duplicates)
- **JWT authentication** (Bearer token)
- **Graceful LLM fallback** (rule-based analysis when Ollama offline)
- **PDF upload** endpoint for single-resume indexing
- **Dark HR dashboard** with score bars, AI summary, bulk actions

---

## 📂 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes_auth.py     # JWT login
│   │   │   ├── routes_ingest.py   # Upload / bulk ingest
│   │   │   └── routes_match.py    # Matching + AI summary
│   │   ├── core/config.py         # Settings (pydantic-settings)
│   │   ├── models/schemas.py      # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── preprocessing.py   # NLP pipeline (spaCy + NLTK)
│   │   │   ├── embeddings.py      # sentence-transformers wrapper
│   │   │   ├── vector_store.py    # ChromaDB singleton
│   │   │   ├── matching_engine.py # Cosine similarity ranking
│   │   │   ├── llm_service.py     # Ollama / LLaMA integration
│   │   │   ├── prepare_datasets.py
│   │   │   ├── ingest_resumes.py
│   │   │   └── ingest_jobs.py
│   │   └── main.py
│   ├── data/
│   │   ├── resumes_raw/           # Raw Kaggle resume CSV
│   │   ├── jobs_raw/              # Raw Kaggle jobs CSV
│   │   └── processed/             # Cleaned CSVs (generated)
│   ├── vector_db/                 # ChromaDB persistent storage
│   ├── requirements.txt
│   ├── run_pipeline.py
│   └── .env.example
├── frontend/
│   └── src/
│       ├── App.tsx                # Full HR dashboard (React)
│       ├── App.css                # Dark theme styles
│       └── api/apiClient.ts       # Typed API client
└── docker-compose.yml
```
