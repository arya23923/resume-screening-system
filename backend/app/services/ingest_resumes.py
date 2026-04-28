import pandas as pd
from app.services.vector_store import VectorStore
from app.services.embeddings import SentenceTransformerEmbeddings

def ingest_resumes(batch_size=50):
    print("Loading cleaned resumes...")
    df = pd.read_csv("data/processed/cleaned_resumes.csv")
    print(f"Found {len(df)} resumes")
    
    # Drop rows with empty cleaned_text
    initial_count = len(df)
    df = df.dropna(subset=['cleaned_text'])
    df = df[df['cleaned_text'].str.strip() != ""]
    print(f"Dropped {initial_count - len(df)} empty/invalid resumes")
    
    # Initialize
    vector_store = VectorStore()
    embedder = SentenceTransformerEmbeddings()
    
    # Prepare data
    ids = [f"resume_{i}" for i in range(len(df))]
    documents = df['cleaned_text'].tolist()
    
    # Prepare metadata (exclude the cleaned text)
    metadata_cols = [c for c in df.columns if c not in ['cleaned_text', 'Resume', 'Resume_str', 'Resume_html']]
    metadatas = df[metadata_cols].to_dict('records')
    
    # Generate embeddings in batches
    print("Generating embeddings...")
    all_embeddings = []
    total_batches = (len(documents) // batch_size) + 1
    
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i+batch_size]
        batch_num = i//batch_size + 1
        print(f"Processing batch {batch_num}/{total_batches} ({len(batch)} items)")
        
        try:
            embeddings = embedder.embed_documents(batch)
            all_embeddings.extend(embeddings)
        except Exception as e:
            print(f"Error on batch {batch_num}: {e}")
            # Try processing one by one to find bad item
            for idx, text in enumerate(batch):
                try:
                    emb = embedder.embed_documents([text])
                    all_embeddings.extend(emb)
                except:
                    print(f"Skipping problematic resume at index {i+idx}")
                    # Add zero vector as placeholder
                    all_embeddings.append([0.0] * 384)
    
    # Add to vector store
    print("Adding to vector database...")
    vector_store.add_resumes(ids, all_embeddings, metadatas, documents)
    
    print(f"✅ Ingested {len(ids)} resumes into ChromaDB")
    print(f"Total in DB: {vector_store.get_collection_stats()['resumes']}")

if __name__ == "__main__":
    ingest_resumes()