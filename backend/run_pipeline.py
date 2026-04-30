#!/usr/bin/env python3
"""
Full pipeline runner — run once to set up the system.
Usage:  cd backend && python run_pipeline.py
"""
import subprocess, os, sys
from dotenv import load_dotenv

load_dotenv()

def run(cmd, label):
    print(f"\n▶ {label}…")
    r = subprocess.run(cmd, shell=True, text=True)
    if r.returncode == 0:
        print(f"✓ {label}")
        return True
    print(f"✗ {label} failed (exit {r.returncode})")
    return False

def check_file(path, name, url):
    if not os.path.exists(path):
        print(f"\n⚠  {name} not found at {path}")
        print(f"   Download from: {url}")
        return False
    return True

def main():
    print("=" * 60)
    print("  AI RESUME SCREENING — PIPELINE SETUP")
    print("=" * 60)

    resume_ok = check_file(
        "data/resumes_raw/UpdatedResumeDataSet.csv",
        "Resume dataset",
        "https://www.kaggle.com/datasets/snehaanbhawal/resume-dataset",
    )
    job_ok = check_file(
        "data/jobs_raw/job_descriptions.csv",
        "Job dataset",
        "https://www.kaggle.com/datasets/ravindrasinghrana/job-description-dataset",
    )
    if not (resume_ok and job_ok):
        print("\nPlace the CSV files in the correct folders, then re-run.")
        sys.exit(1)

    steps = [
        ("python -m app.services.prepare_datasets", "Preprocess datasets (NLP pipeline)"),
        ("python -m app.services.ingest_resumes",   "Embed & ingest resumes → ChromaDB"),
        ("python -m app.services.ingest_jobs",      "Embed & ingest jobs → ChromaDB"),
    ]
    for cmd, label in steps:
        if not run(cmd, label):
            sys.exit(1)

    print("\n" + "=" * 60)
    print("  🎉 PIPELINE COMPLETE!")
    print("=" * 60)
    print("\nStart the API:  uvicorn app.main:app --reload")
    print("Docs:           http://localhost:8000/docs")

if __name__ == "__main__":
    main()
