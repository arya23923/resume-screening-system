# Backend – NLP + Embedding + Vector Database Pipeline

##  Pipeline Overview

```
Kaggle CSV datasets
        ↓
Convert CSV → TXT files
        ↓
Text preprocessing (spaCy + NLTK)
        ↓
SentenceTransformer embeddings
        ↓
Stored in Chroma Vector Database
```

**Vector DB location:** `backend/vector_db/`

---

## 🚀 Setup Instructions

### 1. Install dependencies

```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 2. Download datasets

Place CSV files inside `backend/data/`:

```
backend/data/
├── UpdatedResumeDataSet.csv
└── job_descriptions.csv
```

### 3. Convert CSV → text files

```bash
python -m app.services.prepare_datasets
```

Output directories:

```
data/resumes_raw/
data/jobs_raw/
```

### 4. Ingest into vector DB

```bash
python -m app.services.ingest_resumes
python -m app.services.ingest_jobs
```

### 5. Run the API

```bash
uvicorn app.main:app --reload
```

- **Swagger UI:** http://localhost:8000/docs
- **Test endpoint:** `POST /test-search`