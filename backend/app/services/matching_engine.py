from app.services.vector_store import get_vector_store

def search_resumes(query: str, k: int = 5):
    vectordb = get_vector_store()
    results = vectordb.similarity_search(query, k=k)

    return [
        {
            "content": doc.page_content,
            "metadata": doc.metadata
        }
        for doc in results
    ]