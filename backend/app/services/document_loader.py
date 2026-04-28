from langchain_community.document_loaders import PyPDFLoader
from pathlib import Path

def load_resume_documents(resume_dir: Path):
    docs = []
    for pdf in resume_dir.glob("*.pdf"):
        loader = PyPDFLoader(str(pdf))
        docs.extend(loader.load())
    return docs

def load_job_documents(job_dir: Path):
    docs = []
    for pdf in job_dir.glob("*.pdf"):
        loader = PyPDFLoader(str(pdf))
        docs.extend(loader.load())
    return docs