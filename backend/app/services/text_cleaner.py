"""
Clean raw PDF-extracted text into readable plain English.
PDF extraction often produces: garbled unicode, ligatures, encoding artifacts,
excessive whitespace, broken line breaks, and non-ASCII symbols.
"""
import re
import unicodedata


def clean_pdf_text(text: str) -> str:
    """
    Convert raw PDF-extracted text into clean, readable plain English.
    Safe to call on already-clean text (idempotent).
    """
    if not text:
        return ""

    # 1. Normalize unicode (NFC form handles most ligature/encoding issues)
    text = unicodedata.normalize("NFKC", text)

    # 2. Replace common PDF ligatures and special chars that survive normalization
    replacements = {
        "\ufb01": "fi", "\ufb02": "fl", "\ufb00": "ff",
        "\ufb03": "ffi", "\ufb04": "ffl", "\u2019": "'",
        "\u2018": "'", "\u201c": '"', "\u201d": '"',
        "\u2013": "-", "\u2014": "-", "\u2022": "•",
        "\u00a0": " ", "\u200b": "", "\ufffd": "",
        "\u0000": "", "\x00": "",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)

    # 3. Remove non-printable / non-ASCII control characters (keep \n \t)
    text = re.sub(r"[^\x09\x0A\x0D\x20-\x7E]", " ", text)

    # 4. Collapse lines: single newlines inside a paragraph → space
    #    (but keep double newlines as paragraph breaks)
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)

    # 5. Normalize paragraph breaks to double newline
    text = re.sub(r"\n{3,}", "\n\n", text)

    # 6. Remove lines that are clearly garbage (>40% non-alpha)
    lines = []
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            lines.append("")
            continue
        alpha = sum(c.isalpha() or c.isspace() for c in stripped)
        if alpha / max(len(stripped), 1) >= 0.45:
            lines.append(stripped)
        # keep short lines (could be section headers, dates, etc.)
        elif len(stripped) <= 30:
            lines.append(stripped)
    text = "\n".join(lines)

    # 7. Collapse multiple spaces
    text = re.sub(r"[ \t]{2,}", " ", text)

    # 8. Final strip
    return text.strip()


def extract_readable_preview(raw_text: str, max_chars: int = 800) -> str:
    """Return the first max_chars of cleaned, readable text."""
    cleaned = clean_pdf_text(raw_text)
    if len(cleaned) <= max_chars:
        return cleaned
    # Trim at word boundary
    trimmed = cleaned[:max_chars]
    last_space = trimmed.rfind(" ")
    if last_space > max_chars * 0.8:
        trimmed = trimmed[:last_space]
    return trimmed + "…"
