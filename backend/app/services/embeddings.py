"""
Embedding service using sentence-transformers (all-MiniLM-L6-v2).
384-dimensional dense vectors, fast and free.
"""
from sentence_transformers import SentenceTransformer
from app.core.config import settings
import numpy as np

_model: SentenceTransformer = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print(f"[Embeddings] Loading model: {settings.EMBEDDING_MODEL}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _model


def generate_embedding(text: str) -> list[float]:
    """Embed a single text string."""
    model = get_model()
    return model.encode(text, normalize_embeddings=True).tolist()


def embed_documents(texts: list[str], batch_size: int = 64) -> list[list[float]]:
    """Batch-embed multiple documents."""
    model = get_model()
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=len(texts) > 100,
    )
    return embeddings.tolist()


class SentenceTransformerEmbeddings:
    """Drop-in wrapper for compatibility with older code."""

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return embed_documents(texts)

    def embed_query(self, text: str) -> list[float]:
        return generate_embedding(text)
