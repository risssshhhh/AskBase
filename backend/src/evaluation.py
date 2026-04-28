import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Reusing the same embedding model
eval_embedding_model = SentenceTransformer('all-mpnet-base-v2')

def evaluate_rag(query, answer, retrieved_chunks, ground_truth=None):
    """
    Computes RAG metrics.
    """
    metrics = {}
    
    # 1. Answer Relevance (Cosine similarity between query and answer embeddings)
    query_emb = eval_embedding_model.encode([query])
    answer_emb = eval_embedding_model.encode([answer])
    relevance = cosine_similarity(query_emb, answer_emb)[0][0]
    metrics['answer_relevance'] = float(relevance)
    
    # 2. Faithfulness (Simplified: token overlap proportion between answer and chunks)
    # A true self-RAG would use an LLM here.
    combined_context = " ".join([chunk["text"] for chunk in retrieved_chunks]).lower()
    answer_tokens = set(answer.lower().split())
    context_tokens = set(combined_context.split())
    
    if answer_tokens:
        overlap = len(answer_tokens.intersection(context_tokens))
        faithfulness = overlap / len(answer_tokens)
    else:
        faithfulness = 0.0
    metrics['faithfulness'] = float(faithfulness)
    
    # 3. Context Recall (if ground truth is provided)
    if ground_truth:
        gt_tokens = set(ground_truth.lower().split())
        if gt_tokens:
            gt_overlap = len(gt_tokens.intersection(context_tokens))
            recall = gt_overlap / len(gt_tokens)
        else:
            recall = 0.0
        metrics['context_recall'] = float(recall)
    else:
        metrics['context_recall'] = None
        
    return metrics
