"""
Load resumes from PDF or plain text files.
"""
from pathlib import Path
from pypdf import PdfReader
import re
import docx


def extract_text_from_docx(docx_path: str | Path) -> str:
    """Extract all text from a DOCX file."""
    doc = docx.Document(str(docx_path))
    return "\n".join([paragraph.text for paragraph in doc.paragraphs])


def extract_text_from_file(file_path: str | Path) -> str:
    """Extract text from PDF, DOCX, DOC, or TXT file."""
    path = Path(file_path)
    suffix = path.suffix.lower()
    
    if suffix == ".pdf":
        return extract_text_from_pdf(path)
    elif suffix in [".docx", ".doc"]:
        try:
            return extract_text_from_docx(path)
        except Exception as e:
            print(f"[Loader] Failed to read {suffix} as DOCX: {e}")
            return ""
    elif suffix == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")
    return ""


def extract_text_from_pdf(pdf_path: str | Path) -> str:
    """Extract all text from a PDF file."""
    reader = PdfReader(str(pdf_path))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)


def load_resume_documents(resume_dir: Path) -> list[dict]:
    """Load all resumes in a directory, return list of {filename, text}."""
    docs = []
    # Support multiple formats
    for file_path in list(resume_dir.glob("*.pdf")) + list(resume_dir.glob("*.txt")) + list(resume_dir.glob("*.doc*")):
        try:
            text = extract_text_from_file(file_path)
            if text.strip():
                docs.append({"filename": file_path.name, "text": text})
        except Exception as e:
            print(f"[Loader] Failed to load {file_path.name}: {e}")
    return docs


def load_job_documents(job_dir: Path) -> list[dict]:
    """Load job description TXT, PDF, or Word files."""
    docs = []
    for path in list(job_dir.glob("*.pdf")) + list(job_dir.glob("*.txt")) + list(job_dir.glob("*.doc*")):
        try:
            text = extract_text_from_file(path)
            if text.strip():
                docs.append({"filename": path.name, "text": text})
        except Exception as e:
            print(f"[Loader] Failed to load {path.name}: {e}")
    return docs
