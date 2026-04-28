from app.services.vector_store import resume_collection
from app.services.embeddings import generate_embedding
from app.services.preprocessing import preprocess_pipeline

def search_resumes(job_description: str, k: int = 5):
    processed = preprocess_pipeline(job_description)
    query_embedding = generate_embedding(processed)

    results = resume_collection.query(
        query_embeddings=[query_embedding],
        n_results=k
    )

    output = []
    for i, doc_id in enumerate(results["ids"][0]):
        score = results["distances"][0][i]
        output.append({"id": doc_id, "score": 1 - score})

    return output