"""
ChromaDB vector store with cosine-similarity collections for resumes & jobs.
Singleton pattern so we only open one DB connection per process.
"""
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import VECTOR_DB_DIR

_store = None


def get_vector_store() -> "VectorStore":
    global _store
    if _store is None:
        _store = VectorStore()
    return _store


class VectorStore:
    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=VECTOR_DB_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.resume_collection = self.client.get_or_create_collection(
            name="resumes",
            metadata={"hnsw:space": "cosine"},
        )
        self.job_collection = self.client.get_or_create_collection(
            name="jobs",
            metadata={"hnsw:space": "cosine"},
        )

    # ── Resume operations ──────────────────────────────────

    def add_resumes(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
        documents: list[str],
    ):
        # Upsert to avoid duplicate key errors on re-ingest
        self.resume_collection.upsert(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=documents,
        )

    def search_resumes(
        self, query_embedding: list[float], top_k: int = 10
    ) -> dict:
        count = self.resume_collection.count()
        if count == 0:
            return {"ids": [[]], "distances": [[]], "documents": [[]], "metadatas": [[]]}
        n = min(top_k, count)
        return self.resume_collection.query(
            query_embeddings=[query_embedding],
            n_results=n,
            include=["distances", "documents", "metadatas"],
        )

    # ── Job operations ─────────────────────────────────────

    def add_jobs(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
        documents: list[str],
    ):
        self.job_collection.upsert(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=documents,
        )

    def search_jobs(
        self, query_embedding: list[float], top_k: int = 10
    ) -> dict:
        count = self.job_collection.count()
        if count == 0:
            return {"ids": [[]], "distances": [[]], "documents": [[]], "metadatas": [[]]}
        n = min(top_k, count)
        return self.job_collection.query(
            query_embeddings=[query_embedding],
            n_results=n,
            include=["distances", "documents", "metadatas"],
        )

    # ── Utilities ──────────────────────────────────────────

    def get_collection_stats(self) -> dict:
        return {
            "resumes": self.resume_collection.count(),
            "jobs": self.job_collection.count(),
        }

    def delete_all_resumes(self):
        self.client.delete_collection("resumes")
        self.resume_collection = self.client.get_or_create_collection(
            name="resumes", metadata={"hnsw:space": "cosine"}
        )

    def delete_all_jobs(self):
        self.client.delete_collection("jobs")
        self.job_collection = self.client.get_or_create_collection(
            name="jobs", metadata={"hnsw:space": "cosine"}
        )
