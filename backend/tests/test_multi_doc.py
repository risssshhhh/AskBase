import os
import pytest
import shutil
from src.retrieval import HybridRetriever

TEST_INDEX_DIR = "test_indexes"

@pytest.fixture(scope="module", autouse=True)
def clean_indexes():
    # Cleanup before and after
    if os.path.exists(TEST_INDEX_DIR):
        shutil.rmtree(TEST_INDEX_DIR)
    yield
    if os.path.exists(TEST_INDEX_DIR):
        shutil.rmtree(TEST_INDEX_DIR)

def test_multi_document_retrieval_fusion():
    doc_1 = "test_doc_alpha"
    doc_2 = "test_doc_beta"

    # 1. Build index for Document 1 (Alpha)
    r1 = HybridRetriever(doc_1, index_dir=TEST_INDEX_DIR)
    chunks_1 = [
        {"chunk_id": "chunk_a1", "text": "Python is an interpreted high-level programming language.", "page": 1, "section": "Python", "char_offset": 0},
        {"chunk_id": "chunk_a2", "text": "Flask is a WSGI web application framework written in Python.", "page": 2, "section": "Flask", "char_offset": 0}
    ]
    r1.build_indexes(chunks_1)

    # 2. Build index for Document 2 (Beta)
    r2 = HybridRetriever(doc_2, index_dir=TEST_INDEX_DIR)
    chunks_2 = [
        {"chunk_id": "chunk_b1", "text": "React is a free and open-source front-end JavaScript library.", "page": 1, "section": "React", "char_offset": 0},
        {"chunk_id": "chunk_b2", "text": "Docker is a set of platform as a service products using OS-level virtualization.", "page": 3, "section": "Docker", "char_offset": 0}
    ]
    r2.build_indexes(chunks_2)

    # 3. Instantiate base retriever and verify multi-retrieval
    multi_retriever = HybridRetriever(index_dir=TEST_INDEX_DIR)

    # Query targeting document 1
    res1 = multi_retriever.retrieve_multi([doc_1, doc_2], "What is Flask framework?", top_k=2)
    assert len(res1) > 0
    assert "chunk_a2" in res1

    # Query targeting document 2
    res2 = multi_retriever.retrieve_multi([doc_1, doc_2], "Explain Docker virtualization containerization", top_k=2)
    assert len(res2) > 0
    assert "chunk_b2" in res2

    # Query targeting both documents (merging via RRF)
    res_comb = multi_retriever.retrieve_multi([doc_1, doc_2], "Python programming and React frontend library", top_k=4)
    # Check that chunks from both documents are fused together in the top results
    assert "chunk_a1" in res_comb
    assert "chunk_b1" in res_comb
