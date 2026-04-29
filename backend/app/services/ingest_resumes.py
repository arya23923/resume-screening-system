"""Ingest cleaned resumes CSV into ChromaDB."""
import pandas as pd
from tqdm import tqdm
from app.services.vector_store import get_vector_store
from app.services.embeddings import embed_documents


def ingest_resumes(
    csv_path: str = "data/processed/cleaned_resumes.csv",
    batch_size: int = 64,
) -> int:
    print("📖 Loading cleaned resumes…")
    df = pd.read_csv(csv_path)
    print(f"   Found {len(df)} resumes")

    store = get_vector_store()

    ids = [f"resume_{i}" for i in range(len(df))]
    documents = df["cleaned_text"].fillna("").tolist()

    # Metadata: every column except cleaned_text (convert all to str for Chroma)
    meta_cols = [c for c in df.columns if c not in ["cleaned_text"]]
    metadatas = []
    for _, row in df[meta_cols].iterrows():
        metadatas.append({k: str(v) for k, v in row.items()})

    print("🔢 Generating embeddings…")
    all_embeddings = []
    for i in tqdm(range(0, len(documents), batch_size), desc="Embedding"):
        batch = documents[i : i + batch_size]
        all_embeddings.extend(embed_documents(batch))

    print("💾 Upserting into ChromaDB…")
    for i in range(0, len(ids), batch_size):
        store.add_resumes(
            ids[i : i + batch_size],
            all_embeddings[i : i + batch_size],
            metadatas[i : i + batch_size],
            documents[i : i + batch_size],
        )

    count = store.get_collection_stats()["resumes"]
    print(f"✅ Resumes in DB: {count}")
    return count


if __name__ == "__main__":
    ingest_resumes()
