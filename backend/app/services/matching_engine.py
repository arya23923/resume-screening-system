from app.services.vector_store import VectorStore

def match_resume_to_jobs(resume_id: str, top_k: int = 5):
    """Match a resume against all jobs"""
    try:
        store = VectorStore()
        
        # Get resume embedding
        result = store.resume_collection.get(ids=[resume_id], include=['embeddings'])
        
        # Check if resume exists - SAFE WAY (no numpy array in if statement)
        if result is None:
            print(f"Resume {resume_id} not found - no result")
            return []
        
        if len(result['ids']) == 0:
            print(f"Resume {resume_id} not found in database")
            return []
        
        if len(result['embeddings']) == 0:
            print(f"No embeddings found for resume {resume_id}")
            return []
        
        # Get embedding (safe to access)
        resume_embedding = result['embeddings'][0]
        
        # Search jobs
        results = store.job_collection.query(
            query_embeddings=[resume_embedding],
            n_results=top_k
        )
        
        matches = []
        # Build matches safely
        if results and len(results['ids']) > 0 and len(results['ids'][0]) > 0:
            for i in range(len(results['ids'][0])):
                distance = results['distances'][0][i] if results.get('distances') else 0
                similarity = float(1 - distance)
                
                matches.append({
                    'job_id': str(results['ids'][0][i]),
                    'similarity_score': round(similarity, 4),
                    'rank': i + 1
                })
        
        return matches
    
    except Exception as e:
        print(f"Error in match_resume_to_jobs: {e}")
        import traceback
        traceback.print_exc()
        return []


def match_job_to_resumes(job_id: str, top_k: int = 5):
    """Match a job against all resumes"""
    try:
        store = VectorStore()
        
        # Get job embedding
        result = store.job_collection.get(ids=[job_id], include=['embeddings'])
        
        # Check if job exists - SAFE WAY
        if result is None:
            print(f"Job {job_id} not found - no result")
            return []
        
        if len(result['ids']) == 0:
            print(f"Job {job_id} not found in database")
            return []
        
        if len(result['embeddings']) == 0:
            print(f"No embeddings found for job {job_id}")
            return []
        
        # Get embedding
        job_embedding = result['embeddings'][0]
        
        # Search resumes
        results = store.resume_collection.query(
            query_embeddings=[job_embedding],
            n_results=top_k
        )
        
        matches = []
        # Build matches safely
        if results and len(results['ids']) > 0 and len(results['ids'][0]) > 0:
            for i in range(len(results['ids'][0])):
                distance = results['distances'][0][i] if results.get('distances') else 0
                similarity = float(1 - distance)
                
                matches.append({
                    'resume_id': str(results['ids'][0][i]),
                    'similarity_score': round(similarity, 4),
                    'rank': i + 1
                })
        
        return matches
    
    except Exception as e:
        print(f"Error in match_job_to_resumes: {e}")
        import traceback
        traceback.print_exc()
        return []