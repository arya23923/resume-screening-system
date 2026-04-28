from app.services.document_loader import load_resume_documents
from app.services.vector_store import get_vector_store
from app.core.config import RESUME_DIR

def ingest_resumes():
    docs = load_resume_documents(RESUME_DIR)
    vectordb = get_vector_store()
    vectordb.add_documents(docs)
    vectordb.persist()

    return {"status": "Resumes ingested", "count": len(docs)}