import os
import pandas as pd
from app.core.config import RESUME_DIR, JOB_DIR

def prepare_resume_dataset(csv_path: str):
    df = pd.read_csv(csv_path)
    os.makedirs(RESUME_DIR, exist_ok=True)

    for i, row in df.iterrows():
        with open(f"{RESUME_DIR}/resume_{i}.txt", "w", encoding="utf-8") as f:
            f.write(str(row["Resume"]))

    print("✅ Resume dataset prepared")


def prepare_job_dataset(csv_path: str):
    df = pd.read_csv(csv_path)
    os.makedirs(JOB_DIR, exist_ok=True)

    for i, row in df.iterrows():
        with open(f"{JOB_DIR}/job_{i}.txt", "w", encoding="utf-8") as f:
            f.write(str(row["Job Description"]))

    print("✅ Job dataset prepared")


if __name__ == "__main__":
    prepare_resume_dataset("data/UpdatedResumeDataSet.csv")
    prepare_job_dataset("data/job_descriptions.csv")