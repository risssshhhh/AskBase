import os
import pickle
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from rank_bm25 import BM25Okapi
from collections import defaultdict

# Load embedding model once
embedding_model = SentenceTransformer('all-mpnet-base-v2')

class HybridRetriever:
    def __init__(self, doc_id, index_dir="indexes"):
        self.doc_id = doc_id
        self.index_dir = os.path.join(index_dir, doc_id)
        os.makedirs(self.index_dir, exist_ok=True)
        
        self.faiss_index_path = os.path.join(self.index_dir, "faiss.index")
        self.bm25_path = os.path.join(self.index_dir, "bm25.pkl")
        self.metadata_path = os.path.join(self.index_dir, "metadata.pkl")
        
        self.faiss_index = None
        self.bm25 = None
        self.metadata = [] # stores chunk_ids corresponding to index order
        
        self.load_indexes()

    def load_indexes(self):
        if os.path.exists(self.faiss_index_path):
            self.faiss_index = faiss.read_index(self.faiss_index_path)
        if os.path.exists(self.bm25_path):
            with open(self.bm25_path, "rb") as f:
                self.bm25 = pickle.load(f)
        if os.path.exists(self.metadata_path):
            with open(self.metadata_path, "rb") as f:
                self.metadata = pickle.load(f)

    def build_indexes(self, chunks):
        """
        Builds FAISS and BM25 indexes from a list of chunk dicts.
        """
        texts = [chunk["text"] for chunk in chunks]
        self.metadata = [chunk["chunk_id"] for chunk in chunks]
        
        # Build Dense Index (FAISS)
        embeddings = embedding_model.encode(texts, show_progress_bar=False)
        dim = embeddings.shape[1]
        
        # IndexHNSWFlat is recommended in the prompt
        self.faiss_index = faiss.IndexHNSWFlat(dim, 32)
        self.faiss_index.add(np.array(embeddings, dtype=np.float32))
        
        faiss.write_index(self.faiss_index, self.faiss_index_path)
        
        # Build Sparse Index (BM25)
        tokenized_corpus = [text.lower().split() for text in texts]
        self.bm25 = BM25Okapi(tokenized_corpus)
        
        with open(self.bm25_path, "wb") as f:
            pickle.dump(self.bm25, f)
            
        with open(self.metadata_path, "wb") as f:
            pickle.dump(self.metadata, f)

    def retrieve(self, query, top_k=20):
        if not self.faiss_index or not self.bm25:
            return []
            
        # Dense Retrieval
        query_embedding = embedding_model.encode([query], show_progress_bar=False)
        D, I = self.faiss_index.search(np.array(query_embedding, dtype=np.float32), top_k)
        
        dense_results = []
        for i, idx in enumerate(I[0]):
            if idx != -1 and idx < len(self.metadata):
                dense_results.append(self.metadata[idx])
                
        # Sparse Retrieval
        tokenized_query = query.lower().split()
        bm25_scores = self.bm25.get_scores(tokenized_query)
        top_n_sparse_idx = np.argsort(bm25_scores)[::-1][:top_k]
        
        sparse_results = []
        for idx in top_n_sparse_idx:
            if bm25_scores[idx] > 0 and idx < len(self.metadata):
                sparse_results.append(self.metadata[idx])
                
        # Merge with Reciprocal Rank Fusion (RRF)
        return self._rrf(dense_results, sparse_results, k=60, top_n=top_k)

    def _rrf(self, dense_list, sparse_list, k=60, top_n=20):
        """
        Reciprocal Rank Fusion: score = sum(1 / (k + rank))
        """
        rrf_scores = defaultdict(float)
        
        for rank, chunk_id in enumerate(dense_list):
            rrf_scores[chunk_id] += 1.0 / (k + rank + 1)
            
        for rank, chunk_id in enumerate(sparse_list):
            rrf_scores[chunk_id] += 1.0 / (k + rank + 1)
            
        # Sort by RRF score
        sorted_results = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        return [chunk_id for chunk_id, score in sorted_results[:top_n]]
