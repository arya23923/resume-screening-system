"""
Ingest routes: upload single resume PDF, trigger bulk ingestion from CSV,
and extract readable text from a PDF for the frontend to display.
"""
import io
import os
import uuid
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from app.models.schemas import IngestResponse
from app.services.document_loader import extract_text_from_pdf
from app.services.text_cleaner import clean_pdf_text, extract_readable_preview
from app.services.preprocessing import preprocess_pipeline
from app.services.embeddings import generate_embedding
from app.services.vector_store import get_vector_store

router = APIRouter()


@router.post("/resume/upload")
async def upload_resume(file: UploadFile = File(...)):
    """
    Upload a single resume PDF.
    - Extracts raw text via pypdf
    - Cleans it into readable English
    - Stores the cleaned readable text (NOT the NLP-processed lemmatized version)
      so the frontend can show it properly
    - Returns: id, message, raw_text (clean), preview
    """
    if not file.filename.lower().endswith((".pdf", ".txt")):
        raise HTTPException(status_code=400, detail="Only PDF or TXT files are supported")

    try:
        contents = await file.read()

        if file.filename.lower().endswith(".pdf"):
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(contents)
                tmp_path = tmp.name
            raw_text = extract_text_from_pdf(tmp_path)
            os.unlink(tmp_path)
        else:
            # Plain text file
            raw_text = contents.decode("utf-8", errors="ignore")

        if not raw_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from this file")

        # Clean into readable English (fixes encoding artifacts, ligatures, etc.)
        readable_text = clean_pdf_text(raw_text)
        preview = extract_readable_preview(raw_text, max_chars=800)

        # For vector embedding: use NLP preprocessing on the clean text
        processed = preprocess_pipeline(readable_text)
        embedding = generate_embedding(processed)

        doc_id = f"resume_upload_{uuid.uuid4().hex[:8]}"
        store = get_vector_store()
        store.add_resumes(
            ids=[doc_id],
            embeddings=[embedding],
            # Store the readable text as the document so matching returns readable previews
            metadatas=[{
                "filename": file.filename,
                "source": "upload",
                "category": "Uploaded",
                "doc_id": doc_id,
            }],
            documents=[readable_text],
        )

        return {
            "message": f"Resume '{file.filename}' uploaded and indexed successfully",
            "id": doc_id,
            "count": 1,
            "raw_text": readable_text,      # full clean text for AI analysis
            "preview": preview,              # short preview for library card
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resume/extract-text")
async def extract_text_only(file: UploadFile = File(...)):
    """
    Extract and clean text from a PDF without indexing it.
    Used by the AI Analysis page to get readable text before sending to LLM.
    """
    if not file.filename.lower().endswith((".pdf", ".txt")):
        raise HTTPException(status_code=400, detail="Only PDF or TXT files are supported")

    try:
        contents = await file.read()

        if file.filename.lower().endswith(".pdf"):
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(contents)
                tmp_path = tmp.name
            raw_text = extract_text_from_pdf(tmp_path)
            os.unlink(tmp_path)
        else:
            raw_text = contents.decode("utf-8", errors="ignore")

        if not raw_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from file")

        readable = clean_pdf_text(raw_text)
        return {
            "text": readable,
            "preview": extract_readable_preview(raw_text, max_chars=600),
            "char_count": len(readable),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resumes/bulk", response_model=IngestResponse)
def ingest_resumes_bulk():
    """Trigger bulk ingestion from data/processed/cleaned_resumes.csv."""
    try:
        from app.services.ingest_resumes import ingest_resumes
        count = ingest_resumes()
        return IngestResponse(message="Bulk resume ingestion complete", count=count)
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
    """Run data preparation pipeline."""
    try:
        from app.services.prepare_datasets import prepare_resumes, prepare_jobs
        r = prepare_resumes()
        j = prepare_jobs()
        return {"message": "Datasets prepared", "resumes_processed": len(r), "jobs_processed": len(j)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/reset")
def reset_collections():
    """Delete all indexed data."""
    store = get_vector_store()
    store.delete_all_resumes()
    store.delete_all_jobs()
    return {"message": "All collections cleared"}
