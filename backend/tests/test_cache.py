import os
import pytest
import numpy as np

# Setup isolated test database before importing database dependencies
os.environ["DB_PATH"] = "test_askbase.db"

from src.db import init_db
from src.cache import SemanticCache

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()
    yield
    if os.path.exists("test_askbase.db"):
        try:
            os.remove("test_askbase.db")
        except PermissionError:
            pass

def test_semantic_cache_hit_and_miss():
    cache = SemanticCache(threshold=0.90)
    user_id = 99
    doc_ids = ["test_doc_1", "test_doc_2"]
    
    query = "How do you install dependencies in python?"
    answer = "You can install dependencies using pip install -r requirements.txt."
    chunks = [{"text": "Install dependencies using pip.", "page": 1, "section": "Intro"}]

    # 1. Verify initial miss
    cached_ans, cached_chunks, is_hit = cache.get_cached_response(user_id, doc_ids, query)
    assert not is_hit
    assert cached_ans is None

    # 2. Save response context to cache
    cache.save_to_cache(user_id, doc_ids, query, answer, chunks)

    # 3. Verify exact match hit
    cached_ans, cached_chunks, is_hit = cache.get_cached_response(user_id, doc_ids, query)
    assert is_hit
    assert cached_ans == answer
    assert len(cached_chunks) == 1
    assert cached_chunks[0]["text"] == "Install dependencies using pip."

    # 4. Verify semantically similar query match hit (similarity threshold > 0.90)
    similar_query = "how can I install python dependencies?"
    cached_ans_sim, _, is_hit_sim = cache.get_cached_response(user_id, doc_ids, similar_query)
    assert is_hit_sim
    assert cached_ans_sim == answer

    # 5. Verify different query miss
    different_query = "What is the weather like today?"
    _, _, is_hit_diff = cache.get_cached_response(user_id, doc_ids, different_query)
    assert not is_hit_diff

    # 6. Verify cache miss when document context changes
    different_docs = ["test_doc_3"]
    _, _, is_hit_doc_diff = cache.get_cached_response(user_id, different_docs, query)
    assert not is_hit_doc_diff
