import re
import nltk
import spacy
from nltk.corpus import stopwords

nltk.download("stopwords")

stop_words = set(stopwords.words("english"))
nlp = spacy.load("en_core_web_sm")


def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'\n', ' ', text)
    text = re.sub(r'[^a-zA-Z ]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def remove_stopwords(text: str) -> str:
    tokens = text.split()
    filtered = [w for w in tokens if w not in stop_words]
    return " ".join(filtered)


def lemmatize(text: str) -> str:
    doc = nlp(text)
    lemmas = [token.lemma_ for token in doc]
    return " ".join(lemmas)


def preprocess_pipeline(text: str) -> str:
    text = clean_text(text)
    text = remove_stopwords(text)
    text = lemmatize(text)
    return text