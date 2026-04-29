"""
Matching engine: given a job description, find the top-K resumes
ranked by cosine similarity.
"""
from app.services.vector_store import get_vector_store
from app.services.embeddings import generate_embedding
from app.services.preprocessing import preprocess_pipeline
from app.models.schemas import ResumeMatch


def match_resumes_to_job(
    job_description: str,
    top_k: int = 10,
) -> list[ResumeMatch]:
    """
    Preprocess job description → embed → cosine-search ChromaDB resumes.
    Returns ranked list of ResumeMatch objects (score 0–1, higher = better).
    """
    # 1. Preprocess + embed the job description
    processed_jd = preprocess_pipeline(job_description)
    query_embedding = generate_embedding(processed_jd)

    # 2. Search vector store
    store = get_vector_store()
    results = store.search_resumes(query_embedding, top_k=top_k)

    # 3. Build response objects
    matches: list[ResumeMatch] = []
    ids = results["ids"][0]
    distances = results["distances"][0]
    documents = results["documents"][0]
    metadatas = results["metadatas"][0]

    for doc_id, dist, doc, meta in zip(ids, distances, documents, metadatas):
        # ChromaDB cosine distance: 0 = identical, 2 = opposite
        # Convert to similarity score 0–1
        score = round(max(0.0, 1.0 - dist), 4)

        matches.append(
            ResumeMatch(
                id=doc_id,
                score=score,
                category=meta.get("category", meta.get("Category", "Unknown")),
                preview=doc[:400] if doc else "",
                metadata=meta,
            )
        )

    # Sort descending by score
    matches.sort(key=lambda m: m.score, reverse=True)
    return matches


def match_jobs_to_resume(
    resume_text: str,
    top_k: int = 10,
) -> list[dict]:
    """
    Reverse lookup: given a resume, find best matching jobs.
    """
    processed = preprocess_pipeline(resume_text)
    query_embedding = generate_embedding(processed)

    store = get_vector_store()
    results = store.search_jobs(query_embedding, top_k=top_k)

    matches = []
    for doc_id, dist, doc, meta in zip(
        results["ids"][0],
        results["distances"][0],
        results["documents"][0],
        results["metadatas"][0],
    ):
        score = round(max(0.0, 1.0 - dist), 4)
        matches.append(
            {
                "id": doc_id,
                "score": score,
                "job_title": meta.get("job_title", meta.get("Title", "Unknown")),
                "preview": doc[:300] if doc else "",
                "metadata": meta,
            }
        )

    matches.sort(key=lambda m: m["score"], reverse=True)
    return matches
