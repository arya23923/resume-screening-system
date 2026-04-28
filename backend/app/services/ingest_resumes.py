import os
from tqdm import tqdm
from app.services.document_loader import load_pdf, load_txt
from app.services.preprocessing import preprocess_pipeline
from app.services.embeddings import generate_embedding
from app.services.vector_store import add_document, persist_db

RESUME_FOLDER = "data/resumes_raw"


def ingest_resumes():
    files = os.listdir(RESUME_FOLDER)

    for file in tqdm(files):
        path = os.path.join(RESUME_FOLDER, file)

        if file.endswith(".pdf"):
            text = load_pdf(path)
        elif file.endswith(".txt"):
            text = load_txt(path)
        else:
            continue

        processed = preprocess_pipeline(text)
        embedding = generate_embedding(processed)

        add_document(file, processed, embedding)

    persist_db()
    print("✅ Resume ingestion complete")


if __name__ == "__main__":
    ingest_resumes()