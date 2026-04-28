import chromadb
from chromadb.config import Settings

client = chromadb.Client(
    Settings(persist_directory="vector_db")
)

collection = client.get_or_create_collection(name="resumes")


def add_document(doc_id: str, text: str, embedding):
    collection.add(
        documents=[text],
        embeddings=[embedding],
        ids=[doc_id]
    )


def persist_db():
    client.persist()