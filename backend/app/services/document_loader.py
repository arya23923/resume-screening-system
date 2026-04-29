"""
Load resumes from PDF or plain text files.
"""
from pathlib import Path
from pypdf import PdfReader
import re


def extract_text_from_pdf(pdf_path: str | Path) -> str:
    """Extract all text from a PDF file."""
    reader = PdfReader(str(pdf_path))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)


def load_resume_documents(resume_dir: Path) -> list[dict]:
    """Load all PDFs in a directory, return list of {filename, text}."""
    docs = []
    for pdf_path in resume_dir.glob("*.pdf"):
        try:
            text = extract_text_from_pdf(pdf_path)
            if text.strip():
                docs.append({"filename": pdf_path.name, "text": text})
        except Exception as e:
            print(f"[Loader] Failed to load {pdf_path.name}: {e}")
    return docs


def load_job_documents(job_dir: Path) -> list[dict]:
    """Load job description TXT or PDF files."""
    docs = []
    for path in list(job_dir.glob("*.pdf")) + list(job_dir.glob("*.txt")):
        try:
            if path.suffix == ".pdf":
                text = extract_text_from_pdf(path)
            else:
                text = path.read_text(encoding="utf-8", errors="ignore")
            if text.strip():
                docs.append({"filename": path.name, "text": text})
        except Exception as e:
            print(f"[Loader] Failed to load {path.name}: {e}")
    return docs
