from app.services.document_loader import load_job_documents
from app.services.vector_store import get_vector_store
from app.core.config import JOB_DIR

def ingest_jobs():
    docs = load_job_documents(JOB_DIR)
    vectordb = get_vector_store()
    vectordb.add_documents(docs)
    vectordb.persist()

    return {"status": "Jobs ingested", "count": len(docs)}