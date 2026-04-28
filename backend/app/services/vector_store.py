# app/services/vector_store.py
import chromadb
from chromadb.config import Settings
from app.core.config import VECTOR_DB_DIR
from app.services.embeddings import SentenceTransformerEmbeddings

class VectorStore:
    def __init__(self):
        """Initialize ChromaDB client"""
        self.client = chromadb.PersistentClient(
            path=str(VECTOR_DB_DIR),
            settings=Settings(anonymized_telemetry=False)
        )
        
        # Create or get collections
        self.resume_collection = self.client.get_or_create_collection(
            name="resumes",
            metadata={"hnsw:space": "cosine"}
        )
        
        self.job_collection = self.client.get_or_create_collection(
            name="jobs",
            metadata={"hnsw:space": "cosine"}
        )
        
        # Embedding model
        self.embedder = SentenceTransformerEmbeddings()
    
    def add_resumes(self, ids, embeddings, metadatas, documents):
        """Add resumes to vector store"""
        self.resume_collection.add(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=documents
        )
    
    def add_jobs(self, ids, embeddings, metadatas, documents):
        """Add jobs to vector store"""
        self.job_collection.add(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=documents
        )
    
    def search_resumes(self, query_embedding, top_k=5):
        """Search resumes by embedding"""
        results = self.resume_collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
        return results
    
    def search_jobs(self, query_embedding, top_k=5):
        """Search jobs by embedding"""
        results = self.job_collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
        return results
    
    def get_collection_stats(self):
        """Get counts of documents"""
        return {
            "resumes": self.resume_collection.count(),
            "jobs": self.job_collection.count()
        }