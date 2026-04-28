from sentence_transformers import SentenceTransformer
import numpy as np

class SentenceTransformerEmbeddings:
    def __init__(self, model_name="all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
    
    def embed_documents(self, texts):
        """Embed a list of documents with error handling"""
        # Clean the texts - replace None/NaN with empty string
        cleaned_texts = []
        for text in texts:
            if text is None or (isinstance(text, float) and np.isnan(text)):
                cleaned_texts.append("")
            elif not isinstance(text, str):
                cleaned_texts.append(str(text))
            else:
                cleaned_texts.append(text)
        
        # Replace empty strings with a placeholder
        cleaned_texts = [t if t.strip() else "empty document" for t in cleaned_texts]
        
        # Generate embeddings
        return self.model.encode(cleaned_texts).tolist()
    
    def embed_query(self, text):
        """Embed a single query"""
        if not text or not isinstance(text, str):
            text = "empty query"
        return self.model.encode([text]).tolist()[0]