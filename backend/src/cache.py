import pickle
import numpy as np
import uuid
import json
from src.db import get_db
from src.retrieval import embedding_model

class SemanticCache:
    def __init__(self, threshold=0.92):
        self.threshold = threshold

    def get_cached_response(self, user_id, doc_ids, query_text):
        """
        Looks up the user query in the semantic cache.
        doc_ids is a list of active document IDs.
        Returns: (answer_text, chunks_list, cache_hit) or (None, None, False)
        """
        if not doc_ids or not query_text.strip():
            return None, None, False

        doc_context_key = ",".join(sorted(doc_ids))
        db = get_db()
        
        try:
            rows = db.execute(
                "SELECT query_text, query_embedding, answer_text, chunks_json FROM semantic_cache WHERE user_id = ? AND doc_id = ?",
                (user_id, doc_context_key)
            ).fetchall()
        except Exception as e:
            print(f"[SemanticCache] DB Error reading cache: {e}")
            rows = []
        finally:
            db.close()

        if not rows:
            return None, None, False

        # Embed incoming query to compare similarity
        query_vector = embedding_model.encode([query_text], show_progress_bar=False)[0]
        query_norm = np.linalg.norm(query_vector)
        
        if query_norm == 0:
            return None, None, False

        best_similarity = -1.0
        best_row = None

        for row in rows:
            try:
                cached_embedding = pickle.loads(row["query_embedding"])
                cached_norm = np.linalg.norm(cached_embedding)
                if cached_norm == 0:
                    continue
                # Calculate Cosine Similarity
                similarity = np.dot(query_vector, cached_embedding) / (query_norm * cached_norm)
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_row = row
            except Exception as e:
                print(f"[SemanticCache] Deserialization error: {e}")
                continue

        if best_similarity >= self.threshold and best_row is not None:
            print(f"[SemanticCache] Hit! Similarity: {best_similarity:.4f} for query '{query_text}'")
            try:
                chunks = json.loads(best_row["chunks_json"])
            except Exception:
                chunks = []
            return best_row["answer_text"], chunks, True

        print(f"[SemanticCache] Miss. Best similarity: {best_similarity:.4f} for query '{query_text}'")
        return None, None, False

    def save_to_cache(self, user_id, doc_ids, query_text, answer_text, chunks):
        """
        Saves query, embedding, response text, and chunks to cache.
        """
        if not doc_ids or not query_text.strip() or not answer_text.strip():
            return

        doc_context_key = ",".join(sorted(doc_ids))
        
        try:
            query_vector = embedding_model.encode([query_text], show_progress_bar=False)[0]
            query_embedding_blob = pickle.dumps(query_vector)
        except Exception as e:
            print(f"[SemanticCache] Failed to encode query for caching: {e}")
            return

        cache_id = str(uuid.uuid4())
        chunks_json = json.dumps(chunks)
        db = get_db()
        
        try:
            db.execute(
                "INSERT INTO semantic_cache (cache_id, user_id, doc_id, query_text, query_embedding, answer_text, chunks_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (cache_id, user_id, doc_context_key, query_text, query_embedding_blob, answer_text, chunks_json)
            )
            db.commit()
            print(f"[SemanticCache] Stored query in cache: '{query_text[:40]}...'")
        except Exception as e:
            print(f"[SemanticCache] Failed to store cache entry: {e}")
        finally:
            db.close()
