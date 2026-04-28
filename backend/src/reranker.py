from transformers import CrossEncoder
import numpy as np

# Load the CrossEncoder model once
reranker_model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', max_length=512)

def rerank(query, chunk_texts, top_k=5):
    """
    Re-rank candidates using a Cross-Encoder.
    chunk_texts is a list of strings (the text of the retrieved chunks).
    Returns indices of the top_k chunks.
    """
    if not chunk_texts:
        return []
        
    pairs = [[query, text] for text in chunk_texts]
    
    # Predict scores
    scores = reranker_model.predict(pairs)
    
    # Get top_k indices sorted by score descending
    top_indices = np.argsort(scores)[::-1][:top_k]
    
    return top_indices.tolist()
