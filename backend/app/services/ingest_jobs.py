# app/services/ingest_jobs.py
import pandas as pd
from app.services.vector_store import VectorStore
from app.services.embeddings import SentenceTransformerEmbeddings

def ingest_jobs(batch_size=50):
    """Ingest all jobs into vector database"""
    print("Loading cleaned jobs...")
    # Change this line:
    df = pd.read_csv("data/processed/cleaned_jobs_small.csv")  # instead of cleaned_jobs.csv
    print(f"Found {len(df)} jobs")
    
    # Initialize
    vector_store = VectorStore()
    embedder = SentenceTransformerEmbeddings()
    
    # Prepare data
    ids = [f"job_{i}" for i in range(len(df))]
    documents = df['cleaned_text'].tolist()
    
    # Prepare metadata
    metadata_cols = [c for c in df.columns if c not in ['cleaned_text']]
    metadatas = df[metadata_cols].to_dict('records')
    
    # Generate embeddings in batches
    print("Generating embeddings...")
    all_embeddings = []
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i+batch_size]
        print(f"Processing batch {i//batch_size + 1}/{(len(documents)//batch_size)+1}")
        embeddings = embedder.embed_documents(batch)
        all_embeddings.extend(embeddings)
    
    # Add to vector store
    print("Adding to vector database...")
    vector_store.add_jobs(ids, all_embeddings, metadatas, documents)
    
    print(f"✅ Ingested {len(ids)} jobs into ChromaDB")
    print(f"Total in DB: {vector_store.get_collection_stats()['jobs']}")

if __name__ == "__main__":
    ingest_jobs()