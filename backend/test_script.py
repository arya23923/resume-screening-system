# test_my_part.py - Run this to verify everything works
import os
import sys

def test_setup():
    """Test 1: Check directories and files"""
    print("\n1. Testing directory structure...")
    
    # Check data directories exist
    assert os.path.exists("data/resumes_raw"), "Missing data/resumes_raw/"
    assert os.path.exists("data/jobs_raw"), "Missing data/jobs_raw/"
    assert os.path.exists("data/processed"), "Missing data/processed/"
    
    # Check dataset files exist
    resume_files = os.listdir("data/resumes_raw/")
    job_files = os.listdir("data/jobs_raw/")
    
    assert any('resume' in f.lower() for f in resume_files), "No resume CSV found"
    assert any('job' in f.lower() for f in job_files), "No job CSV found"
    
    print("✓ Directories and files exist")

def test_preprocessing():
    """Test 2: Preprocessing works"""
    print("\n2. Testing preprocessing...")
    from app.services.preprocessing import preprocess_pipeline
    
    test_text = "Hello!!! I'm a Python Developer with 5+ years of experience!!"
    cleaned = preprocess_pipeline(test_text)
    
    assert 'python' in cleaned.lower()
    assert 'developer' in cleaned.lower()
    assert 'hello' in cleaned.lower()
    assert '!!!' not in cleaned
    assert '+' not in cleaned
    
    print(f"✓ Preprocessing works: '{cleaned[:50]}...'")

def test_embeddings():
    """Test 3: Embeddings work"""
    print("\n3. Testing embeddings...")
    from app.services.embeddings import SentenceTransformerEmbeddings
    
    embedder = SentenceTransformerEmbeddings()
    test_texts = ["Python developer", "Data scientist"]
    embeddings = embedder.embed_documents(test_texts)
    
    assert len(embeddings) == 2
    assert len(embeddings[0]) == 384  # all-MiniLM-L6-v2 dimension
    assert isinstance(embeddings[0][0], float)
    
    print("✓ Embeddings work (384-dim vectors)")

def test_vector_store():
    """Test 4: Vector store operations"""
    print("\n4. Testing vector store...")
    from app.services.vector_store import VectorStore
    
    store = VectorStore()
    
    # Test adding
    test_ids = ["test_1", "test_2"]
    test_embeddings = [[0.1]*384, [0.9]*384]
    test_metadatas = [{"type": "test1"}, {"type": "test2"}]
    test_docs = ["test document 1", "test document 2"]
    
    store.add_resumes(test_ids, test_embeddings, test_metadatas, test_docs)
    
    # Test searching
    results = store.search_resumes([0.1]*384, top_k=1)
    assert len(results['ids'][0]) == 1
    assert results['ids'][0][0] == "test_1"
    
    # Test stats
    stats = store.get_collection_stats()
    assert 'resumes' in stats
    assert 'jobs' in stats
    
    print(f"✓ Vector store works (has {stats['resumes']} resumes, {stats['jobs']} jobs)")

def test_ingestion():
    """Test 5: Ingestion pipeline"""
    print("\n5. Testing ingestion...")
    
    # Check if we have processed data
    if os.path.exists("data/processed/cleaned_resumes.csv"):
        import pandas as pd
        df = pd.read_csv("data/processed/cleaned_resumes.csv")
        print(f"✓ Found {len(df)} cleaned resumes")
    else:
        print("⚠ No cleaned data yet - run prepare_datasets.py first")
    
    if os.path.exists("data/processed/cleaned_jobs.csv"):
        import pandas as pd
        df = pd.read_csv("data/processed/cleaned_jobs.csv")
        print(f"✓ Found {len(df)} cleaned jobs")
    else:
        print("⚠ No cleaned data yet - run prepare_datasets.py first")

def main():
    print("="*50)
    print("TESTING ARYA'S COMPONENTS")
    print("="*50)
    
    try:
        test_setup()
        test_preprocessing()
        test_embeddings()
        test_vector_store()
        test_ingestion()
        
        print("\n" + "="*50)
        print("✅ ALL TESTS PASSED!")
        print("="*50)
        print("\nYour part is ready for handoff!")
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()