"""
Ingest routes: upload single resume PDF, or trigger bulk ingestion from CSV.
"""
import io
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from app.models.schemas import IngestResponse
from app.services.document_loader import extract_text_from_file
from app.services.preprocessing import preprocess_pipeline
from app.services.embeddings import generate_embedding
from app.services.vector_store import get_vector_store
from app.api.routes_auth import get_current_user

router = APIRouter()


@router.post("/resume/upload", response_model=IngestResponse)
async def upload_resume(
    file: UploadFile = File(...),
    # current_user: dict = Depends(get_current_user),  # uncomment to require auth
):
    """Upload a single resume document and index it immediately."""
    ext = file.filename.lower().split(".")[-1]
    if ext not in ["pdf", "txt", "doc", "docx"]:
        raise HTTPException(status_code=400, detail="Only PDF, TXT, DOC, and DOCX files are supported")

    try:
        contents = await file.read()
        import tempfile, os
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        raw_text = extract_text_from_file(tmp_path)
        os.unlink(tmp_path)

        if not raw_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from PDF")

        cleaned = preprocess_pipeline(raw_text)
        embedding = generate_embedding(cleaned)

        doc_id = f"resume_upload_{uuid.uuid4().hex[:8]}"
        store = get_vector_store()
        store.add_resumes(
            ids=[doc_id],
            embeddings=[embedding],
            metadatas=[{"filename": file.filename, "source": "upload", "category": "Uploaded"}],
            documents=[cleaned],
        )

        return IngestResponse(
            message=f"Resume '{file.filename}' indexed successfully", 
            count=1,
            id=doc_id,
            preview=cleaned[:600]
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract")
async def extract_text(file: UploadFile = File(...)):
    """Extract text from an uploaded file without indexing it."""
    ext = file.filename.lower().split(".")[-1]
    if ext not in ["pdf", "txt", "doc", "docx"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    try:
        contents = await file.read()
        import tempfile, os
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        raw_text = extract_text_from_file(tmp_path)
        os.unlink(tmp_path)
        return {"text": raw_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resumes/bulk", response_model=IngestResponse)
def ingest_resumes_bulk(background_tasks: BackgroundTasks):
    """Trigger bulk ingestion from data/processed/cleaned_resumes.csv."""
    errors = []
    try:
        from app.services.ingest_resumes import ingest_resumes
        count = ingest_resumes()
        return IngestResponse(message="Bulk resume ingestion complete", count=count, errors=errors)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs/bulk", response_model=IngestResponse)
def ingest_jobs_bulk():
    """Trigger bulk ingestion from data/processed/cleaned_jobs.csv."""
    try:
        from app.services.ingest_jobs import ingest_jobs
        count = ingest_jobs()
        return IngestResponse(message="Bulk job ingestion complete", count=count)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/prepare")
def prepare_datasets():
    """Run the full data preparation pipeline (preprocess raw CSVs)."""
    try:
        from app.services.prepare_datasets import prepare_resumes, prepare_jobs
        r = prepare_resumes()
        j = prepare_jobs()
        return {
            "message": "Datasets prepared",
            "resumes_processed": len(r),
            "jobs_processed": len(j),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/reset")
def reset_collections():
    """Delete all indexed data (use with caution)."""
    store = get_vector_store()
    store.delete_all_resumes()
    store.delete_all_jobs()
    return {"message": "All collections cleared"}
