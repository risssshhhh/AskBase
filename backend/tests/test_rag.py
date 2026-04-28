import pytest
from src.ingestion import chunk_content
from src.retrieval import HybridRetriever

def test_chunk_content():
    content_list = [
        {"text": "This is a sentence. This is another sentence.", "page": 1, "section": "Intro"}
    ]
    chunks = chunk_content(content_list, "doc_123", max_chunk_size=50)
    assert len(chunks) > 0
    assert chunks[0]["doc_id"] == "doc_123"
    assert "This is a sentence." in chunks[0]["text"]

def test_rrf_logic():
    retriever = HybridRetriever("dummy", index_dir="/tmp/indexes")
    
    dense_list = ["chunk_1", "chunk_2", "chunk_3"]
    sparse_list = ["chunk_3", "chunk_1", "chunk_4"]
    
    # RRF(chunk_3) = 1/(60+3) + 1/(60+1)
    # RRF(chunk_1) = 1/(60+1) + 1/(60+2)
    
    merged = retriever._rrf(dense_list, sparse_list, k=60, top_n=5)
    
    assert len(merged) == 4
    assert merged[0] in ["chunk_1", "chunk_3"] # both are high ranked
