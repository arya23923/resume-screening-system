# run_pipeline.py - Run this ONCE to set everything up
import subprocess
import os

def run_command(cmd, description):
    print(f"\n▶ {description}...")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"✓ {description} successful")
        return True
    else:
        print(f"✗ {description} failed")
        print(result.stderr)
        return False

def main():
    print("="*60)
    print("ARYA'S DATA PIPELINE SETUP")
    print("="*60)
    
    # Check if datasets exist
    if not os.path.exists("data/resumes_raw/UpdatedResumeDataSet.csv"):
        print("\n⚠ WARNING: Resume dataset not found!")
        print("Please download from: https://www.kaggle.com/datasets/snehaanbhawal/resume-dataset")
        print("Place the CSV file in: data/resumes_raw/")
        return
    
    if not os.path.exists("data/jobs_raw/job_descriptions.csv"):
        print("\n⚠ WARNING: Job dataset not found!")
        print("Please download from: https://www.kaggle.com/datasets/ravindrasinghrana/job-description-dataset")
        print("Place the CSV file in: data/jobs_raw/")
        return
    
    # Step 1: Prepare datasets
    if not run_command("cd backend && python -m app.services.prepare_datasets", "Preparing datasets"):
        return
    
    # Step 2: Ingest resumes
    if not run_command("cd backend && python -m app.services.ingest_resumes", "Ingesting resumes"):
        return
    
    # Step 3: Ingest jobs
    if not run_command("cd backend && python -m app.services.ingest_jobs", "Ingesting jobs"):
        return
    
    # Step 4: Run tests
    if not run_command("cd backend && python test_my_part.py", "Running tests"):
        return
    
    print("\n" + "="*60)
    print("🎉 PIPELINE COMPLETE!")
    print("="*60)
    print("\nYour data is now in ChromaDB and ready for teammates!")
    print("\nStats:")
    
    # Show final stats
    from app.services.vector_store import VectorStore
    store = VectorStore()
    stats = store.get_collection_stats()
    print(f"  - Resumes in DB: {stats['resumes']}")
    print(f"  - Jobs in DB: {stats['jobs']}")

if __name__ == "__main__":
    main()