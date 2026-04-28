from pypdf import PdfReader


def load_pdf(path: str) -> str:
    reader = PdfReader(path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + " "
    return text


def load_txt(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()