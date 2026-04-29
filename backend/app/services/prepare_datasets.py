"""
Prepare raw CSV datasets into cleaned CSVs for ingestion.
Handles multiple column name variations from Kaggle datasets.
"""
import os
import pandas as pd
from app.services.preprocessing import preprocess_pipeline


def prepare_resumes(
    input_path: str = "data/resumes_raw/UpdatedResumeDataSet.csv",
    output_path: str = "data/processed/cleaned_resumes.csv",
) -> pd.DataFrame:
    print(f"📂 Loading resumes from {input_path}")
    df = pd.read_csv(input_path)
    print(f"📊 Loaded {len(df)} resumes | Columns: {df.columns.tolist()}")

    # Find text column
    text_col = next(
        (c for c in ["Resume", "Resume_str", "resume_text", "ResumeText", "Text"] if c in df.columns),
        None,
    )
    if text_col is None:
        raise ValueError(f"No resume text column found. Available: {df.columns.tolist()}")
    print(f"📝 Using text column: '{text_col}'")

    print("🔄 Preprocessing resumes (this may take a few minutes)…")
    df["cleaned_text"] = df[text_col].fillna("").apply(preprocess_pipeline)
    df["original_text"] = df[text_col].fillna("")
    df["category"] = df["Category"] if "Category" in df.columns else "Unknown"
    df["resume_id"] = df["ID"].astype(str) if "ID" in df.columns else [f"resume_{i}" for i in range(len(df))]

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"✅ Saved {len(df)} cleaned resumes → {output_path}")
    return df


def prepare_jobs(
    input_path: str = "data/jobs_raw/job_descriptions.csv",
    output_path: str = "data/processed/cleaned_jobs.csv",
) -> pd.DataFrame:
    print(f"\n📂 Loading jobs from {input_path}")
    df = pd.read_csv(input_path)
    print(f"📊 Loaded {len(df)} jobs | Columns: {df.columns.tolist()}")

    desc_col = next(
        (c for c in ["Job Description", "job_description", "Description", "description", "JD"] if c in df.columns),
        None,
    )
    if desc_col is None:
        raise ValueError(f"No job description column found. Available: {df.columns.tolist()}")
    print(f"📝 Using description column: '{desc_col}'")

    print("🔄 Preprocessing job descriptions…")
    df["cleaned_text"] = df[desc_col].fillna("").apply(preprocess_pipeline)
    df["original_text"] = df[desc_col].fillna("")

    title_col = next(
        (c for c in ["Title", "title", "Job Title", "job_title", "JobTitle"] if c in df.columns),
        None,
    )
    df["job_title"] = df[title_col] if title_col else "Unknown"

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"✅ Saved {len(df)} cleaned jobs → {output_path}")
    return df


if __name__ == "__main__":
    print("=" * 55)
    print("  DATA PREPARATION PIPELINE")
    print("=" * 55)
    try:
        prepare_resumes()
        prepare_jobs()
        print("\n🎉 DATA PREPARATION COMPLETE!")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback; traceback.print_exc()
