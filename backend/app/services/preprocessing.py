"""
NLP preprocessing pipeline:
  1. Lowercase + strip HTML/special chars
  2. Stopword removal (NLTK)
  3. Lemmatization (spaCy en_core_web_sm)
"""
import re
import nltk
import spacy

nltk.download("stopwords", quiet=True)
from nltk.corpus import stopwords

STOP_WORDS = set(stopwords.words("english"))

# Lazy-load spaCy model
_nlp = None

def get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])
        except OSError:
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"], check=True)
            _nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])
    return _nlp


def clean_text(text: str) -> str:
    """Lowercase, strip HTML tags, remove special chars."""
    text = str(text)
    text = re.sub(r"<[^>]+>", " ", text)         # remove HTML tags
    text = text.lower()
    text = re.sub(r"\n|\r|\t", " ", text)
    text = re.sub(r"[^a-zA-Z ]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def remove_stopwords(text: str) -> str:
    tokens = text.split()
    return " ".join(w for w in tokens if w not in STOP_WORDS)


def lemmatize(text: str) -> str:
    nlp = get_nlp()
    doc = nlp(text)
    return " ".join(token.lemma_ for token in doc)


def preprocess_pipeline(text: str) -> str:
    """Full NLP pipeline: clean → remove stopwords → lemmatize."""
    text = clean_text(text)
    text = remove_stopwords(text)
    text = lemmatize(text)
    return text


def extract_skills_keywords(text: str) -> list[str]:
    """Simple keyword extractor for display purposes."""
    nlp = get_nlp()
    doc = nlp(text[:5000])  # limit for speed
    keywords = []
    for chunk in doc.noun_chunks:
        kw = chunk.text.strip().lower()
        if 2 < len(kw) < 40:
            keywords.append(kw)
    return list(set(keywords))[:20]
