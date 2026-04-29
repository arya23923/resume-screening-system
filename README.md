# resume-screening-system

##  How to Run

### 1. Install dependencies
```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 2. Place CSV files in `backend/data/`
Required files:
- `UpdatedResumeDataSet.csv`
- `job_descriptions.csv`

### 3. Convert CSV to text files
```bash
python -m app.services.prepare_datasets
```

### 4. Ingest into vector database
```bash
python -m app.services.ingest_resumes
python -m app.services.ingest_jobs
```

### 5. Start the API server
```bash
uvicorn app.main:app --reload
```

### 6. Test the API
Open Swagger UI: `http://localhost:8000/docs`

Send a `POST` request to `/test-search` with a job description to get matching resumes.