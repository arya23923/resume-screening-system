"""
Ingest routes: upload resume PDF/TXT/DOC/DOCX, extract text,
clean it, generate embeddings, and store in vector DB.
"""

import os
import uuid
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException

from app.models.schemas import IngestResponse
from app.services.document_loader import extract_text_from_file
from app.services.text_cleaner import clean_pdf_text, extract_readable_preview
from app.services.preprocessing import preprocess_pipeline
from app.services.embeddings import generate_embedding
from app.services.vector_store import get_vector_store

router = APIRouter()


# =========================
# UPLOAD + INDEX RESUME
# =========================
@router.post("/resume/upload", response_model=IngestResponse)
async def upload_resume(file: UploadFile = File(...)):
    """
    Upload resume file, extract text, clean it,
    generate embedding, and store in vector DB.
    """

    allowed_ext = ["pdf", "txt", "doc", "docx"]
    ext = file.filename.lower().split(".")[-1]

    if ext not in allowed_ext:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, TXT, DOC, and DOCX files are supported"
        )

    try:
        contents = await file.read()

        # Save temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        # Extract text
        raw_text = extract_text_from_file(tmp_path)
        os.unlink(tmp_path)

        if not raw_text or not raw_text.strip():
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from this file"
            )

        # Clean text
        readable_text = clean_pdf_text(raw_text)

        # Preview for UI
        preview = extract_readable_preview(readable_text, max_chars=600)

        # NLP preprocessing
        processed_text = preprocess_pipeline(readable_text)

        # Generate embedding
        embedding = generate_embedding(processed_text)

        # Create unique id
        doc_id = f"resume_{uuid.uuid4().hex[:8]}"

        # Store in vector DB
        store = get_vector_store()

        store.add_resumes(
            ids=[doc_id],
            embeddings=[embedding],
            documents=[readable_text],
            metadatas=[{
                "filename": file.filename,
                "source": "upload",
                "doc_id": doc_id,
                "category": "Uploaded"
            }]
        )

        return IngestResponse(
            message=f"Resume '{file.filename}' uploaded successfully",
            count=1,
            id=doc_id,
            preview=preview
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# EXTRACT TEXT ONLY
# =========================
@router.post("/resume/extract-text")
async def extract_text_only(file: UploadFile = File(...)):
    """
    Extract readable text only.
    No embedding, no indexing.
    """

    allowed_ext = ["pdf", "txt", "doc", "docx"]
    ext = file.filename.lower().split(".")[-1]

    if ext not in allowed_ext:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type"
        )

    try:
        contents = await file.read()

        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        raw_text = extract_text_from_file(tmp_path)
        os.unlink(tmp_path)

        if not raw_text or not raw_text.strip():
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from file"
            )

        readable = clean_pdf_text(raw_text)
        preview = extract_readable_preview(readable, max_chars=600)

        return {
            "text": readable,
            "preview": preview,
            "char_count": len(readable)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# BULK INGEST RESUMES
# =========================
@router.post("/resumes/bulk", response_model=IngestResponse)
def ingest_resumes_bulk():
    try:
        from app.services.ingest_resumes import ingest_resumes

        count = ingest_resumes()

        return IngestResponse(
            message="Bulk resume ingestion complete",
            count=count
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# BULK INGEST JOBS
# =========================
@router.post("/jobs/bulk", response_model=IngestResponse)
def ingest_jobs_bulk():
    try:
        from app.services.ingest_jobs import ingest_jobs

        count = ingest_jobs()

        return IngestResponse(
            message="Bulk job ingestion complete",
            count=count
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# DATA PREPARATION
# =========================
@router.post("/prepare")
def prepare_datasets():
    try:
        from app.services.prepare_datasets import prepare_resumes, prepare_jobs

        resumes = prepare_resumes()
        jobs = prepare_jobs()

        return {
            "message": "Datasets prepared",
            "resumes_processed": len(resumes),
            "jobs_processed": len(jobs)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# RESET VECTOR DB
# =========================
@router.delete("/reset")
def reset_collections():
    store = get_vector_store()
    store.delete_all_resumes()
    store.delete_all_jobs()

    return {
        "message": "All collections cleared"
    }