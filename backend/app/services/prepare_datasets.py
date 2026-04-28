# app/services/prepare_datasets.py
import pandas as pd
import os
from app.services.preprocessing import preprocess_pipeline

def prepare_resumes():
    """Process resume CSV file"""
    input_path = "data/resumes_raw/UpdatedResumeDataSet.csv"
    output_path = "data/processed/cleaned_resumes.csv"
    
    print(f"📂 Loading resumes from {input_path}")
    df = pd.read_csv(input_path)
    print(f"📊 Loaded {len(df)} resumes")
    print(f"📋 Columns: {df.columns.tolist()}")
    
    # Find the text column - CHECK FOR THESE POSSIBLE NAMES
    text_column = None
    possible_text_columns = ['Resume', 'Resume_str', 'resume_text', 'ResumeText', 'Text']
    
    for col in possible_text_columns:
        if col in df.columns:
            text_column = col
            break
    
    if text_column is None:
        print(f"❌ Can't find text column. Available: {df.columns.tolist()}")
        raise ValueError(f"No resume text column found. Tried: {possible_text_columns}")
    
    print(f"📝 Using text column: '{text_column}'")
    
    # Apply preprocessing to each resume
    print("🔄 Cleaning resume texts...")
    print("⏳ This may take a few minutes...")
    df['cleaned_text'] = df[text_column].apply(preprocess_pipeline)
    
    # Keep category if exists
    if 'Category' in df.columns:
        df['category'] = df['Category']
    else:
        df['category'] = "Unknown"
    
    # Keep ID if exists
    if 'ID' in df.columns:
        df['resume_id'] = df['ID']
    else:
        df['resume_id'] = [f"resume_{i}" for i in range(len(df))]
    
    # Save
    os.makedirs("data/processed", exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"✅ Saved to {output_path}")
    print(f"   Sample: {df['cleaned_text'].iloc[0][:100]}...")
    
    return df

def prepare_jobs():
    """Process job descriptions CSV file"""
    input_path = "data/jobs_raw/job_descriptions.csv"
    output_path = "data/processed/cleaned_jobs.csv"
    
    print(f"\n📂 Loading jobs from {input_path}")
    df = pd.read_csv(input_path)
    print(f"📊 Loaded {len(df)} jobs")
    print(f"📋 Columns: {df.columns.tolist()}")
    
    # Find the job description column - CHECK FOR THESE POSSIBLE NAMES
    desc_column = None
    possible_desc_columns = ['Job Description', 'job_description', 'Description', 'description', 'JD']
    
    for col in possible_desc_columns:
        if col in df.columns:
            desc_column = col
            break
    
    if desc_column is None:
        print(f"❌ Can't find description column. Available: {df.columns.tolist()}")
        raise ValueError(f"No job description column found. Tried: {possible_desc_columns}")
    
    print(f"📝 Using description column: '{desc_column}'")
    
    # Apply preprocessing
    print("🔄 Cleaning job descriptions...")
    df['cleaned_text'] = df[desc_column].apply(preprocess_pipeline)
    
    # Extract job title if exists
    title_column = None
    possible_title_columns = ['Title', 'title', 'Job Title', 'job_title', 'JobTitle']
    
    for col in possible_title_columns:
        if col in df.columns:
            title_column = col
            break
    
    if title_column:
        df['job_title'] = df[title_column]
        print(f"📌 Using title column: '{title_column}'")
    else:
        df['job_title'] = "Unknown"
        print("📌 No title column found, using 'Unknown'")
    
    # Save
    df.to_csv(output_path, index=False)
    print(f"✅ Saved to {output_path}")
    print(f"   Sample: {df['cleaned_text'].iloc[0][:100]}...")
    
    return df

if __name__ == "__main__":
    print("="*50)
    print("DATA PREPARATION PIPELINE")
    print("="*50)
    
    try:
        prepare_resumes()
        prepare_jobs()
        print("\n" + "="*50)
        print("🎉 DATA PREPARATION COMPLETE!")
        print("="*50)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()