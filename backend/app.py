import os
import uuid
import json
import time
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from werkzeug.utils import secure_filename

from src.db import get_db, init_db
from src.auth import generate_token, token_required, hash_password, verify_password
from src.ingestion import process_document
from src.retrieval import HybridRetriever
from src.reranker import rerank
from src.router import router
from src.evaluation import evaluate_rag
from src.cache import SemanticCache

app = Flask(__name__)
# Expose custom headers so CORS client can read session metadata
CORS(app, expose_headers=['X-Session-ID', 'X-Chunks'])

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize DB
with app.app_context():
    init_db()

semantic_cache = SemanticCache()

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
        
    db = get_db()
    try:
        db.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", 
                   (username, hash_password(password)))
        db.commit()
    except Exception as e:
        return jsonify({"error": "Username might already exist"}), 400
        
    return jsonify({"message": "User created successfully"}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    
    if user and verify_password(user['password_hash'], password):
        token = generate_token(user['id'])
        return jsonify({"token": token, "user_id": user['id']})
        
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/upload', methods=['POST'])
@token_required
def upload(current_user_id):
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    # Security validations
    allowed_exts = {'pdf', 'docx', 'txt', 'md'}
    ext = file.filename.lower().split('.')[-1]
    if ext not in allowed_exts:
        return jsonify({"error": "Unsupported file type. Allowed: PDF, DOCX, TXT, MD"}), 400
        
    # Check file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Reset pointer
    if file_size > 15 * 1024 * 1024:
        return jsonify({"error": "File exceeds maximum size of 15MB"}), 400

    filename = secure_filename(file.filename)
    doc_id = str(uuid.uuid4())
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"{doc_id}_{filename}")
    file.save(filepath)
    
    db = get_db()
    db.execute("INSERT INTO documents (doc_id, user_id, filename) VALUES (?, ?, ?)",
               (doc_id, current_user_id, filename))
               
    # Ingestion Pipeline
    try:
        chunks = process_document(filepath, doc_id)
        
        # Save chunks to DB
        for chunk in chunks:
            db.execute("INSERT INTO chunks (chunk_id, doc_id, text, page, section, char_offset) VALUES (?, ?, ?, ?, ?, ?)",
                       (chunk["chunk_id"], doc_id, chunk["text"], chunk["page"], chunk["section"], chunk["char_offset"]))
        db.commit()
        
        # Build Hybrid Retriever Indexes
        retriever = HybridRetriever(doc_id)
        retriever.build_indexes(chunks)
        
        return jsonify({"message": "Document processed successfully", "doc_id": doc_id, "num_chunks": len(chunks)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/documents', methods=['GET'])
@token_required
def get_documents(current_user_id):
    db = get_db()
    docs = db.execute("SELECT doc_id, filename, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC", (current_user_id,)).fetchall()
    return jsonify([dict(d) for d in docs])

@app.route('/chat', methods=['POST'])
@token_required
def chat(current_user_id):
    data = request.json
    query = data.get('query')
    doc_ids = data.get('doc_ids')
    session_id = data.get('session_id')
    
    # Backwards compatibility support for single doc_id string
    if not doc_ids and data.get('doc_id'):
        doc_ids = [data.get('doc_id')]
        
    if not doc_ids:
        return jsonify({"error": "No documents specified for retrieval context"}), 400
        
    db = get_db()
    
    # Verify owner permission for all doc_ids
    for d_id in doc_ids:
        doc = db.execute("SELECT * FROM documents WHERE doc_id = ? AND user_id = ?", (d_id, current_user_id)).fetchone()
        if not doc:
            return jsonify({"error": f"Document {d_id} not found or access denied"}), 403
            
    if not session_id:
        session_id = str(uuid.uuid4())
        primary_doc_id = doc_ids[0]
        db.execute("INSERT INTO sessions (session_id, user_id, doc_id, title) VALUES (?, ?, ?, ?)",
                   (session_id, current_user_id, primary_doc_id, query[:50]))
        db.commit()

    # 1. Check Semantic Cache
    cached_answer, cached_chunks, is_hit = semantic_cache.get_cached_response(current_user_id, doc_ids, query)
    if is_hit:
        def generate_cached():
            # Stream the cached answer in small chunks to simulate real-time typing
            chunk_size = 15
            for i in range(0, len(cached_answer), chunk_size):
                text_slice = cached_answer[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'token', 'content': text_slice})}\n\n"
                time.sleep(0.01)
                
            # Yield metadata at the end
            metadata = {
                "type": "metadata",
                "chunks": cached_chunks,
                "session_id": session_id,
                "cache_hit": True,
                "model_used": "semantic_cache",
                "metrics": {"faithfulness": 1.0, "answer_relevance": 1.0}
            }
            yield f"data: {json.dumps(metadata)}\n\n"
            
            # Save messages in history
            conn = get_db()
            conn.execute("INSERT INTO messages (session_id, role, content) VALUES (?, 'user', ?)", (session_id, query))
            conn.execute("INSERT INTO messages (session_id, role, content, latency_ms, model_used, faithfulness_score, retrieved_chunks) VALUES (?, 'assistant', ?, 0, 'semantic_cache', 1.0, ?)",
                       (session_id, cached_answer, json.dumps(cached_chunks)))
            conn.commit()
            conn.close()

        return Response(stream_with_context(generate_cached()), mimetype='text/event-stream', headers={'X-Session-ID': session_id})

    # 2. Retrieve history
    history_rows = db.execute("SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 6", (session_id,)).fetchall()
    history = [{"role": row["role"], "content": row["content"]} for row in history_rows]

    # 3. RAG Retrieval across selected doc indices
    retriever = HybridRetriever()
    retrieved_chunk_ids = retriever.retrieve_multi(doc_ids, query, top_k=20)
    
    chunk_data = []
    if retrieved_chunk_ids:
        placeholders = ','.join('?' * len(retrieved_chunk_ids))
        chunks = db.execute(f"SELECT * FROM chunks WHERE chunk_id IN ({placeholders})", tuple(retrieved_chunk_ids)).fetchall()
        
        # Cross-Encoder Reranking
        chunk_texts = [c["text"] for c in chunks]
        top_indices = rerank(query, chunk_texts, top_k=5)
        top_chunks = [chunks[i] for i in top_indices]
        
        for c in top_chunks:
            chunk_data.append({
                "chunk_id": c["chunk_id"],
                "text": c["text"],
                "page": c["page"],
                "section": c["section"],
                "doc_id": c["doc_id"]
            })
            
    # Formulate Context
    context_str = "\n".join([f"[Chunk {i+1}, Page {c['page']}] {c['text']}" for i, c in enumerate(chunk_data)])
    prompt = f"CONTEXT:\n{context_str}\n\nUSER QUERY: {query}\nANSWER:"
    
    # LLM Router Streaming
    llm_response = router.generate_stream(prompt, history)
    
    def generate():
        full_answer = ""
        for chunk in llm_response["stream"]:
            full_answer += chunk
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
            
        # Post-generation: Evaluation & DB saving
        metrics = evaluate_rag(query, full_answer, chunk_data)
        
        # Save cache entry
        semantic_cache.save_to_cache(current_user_id, doc_ids, query, full_answer, chunk_data)
        
        conn = get_db()
        conn.execute("INSERT INTO messages (session_id, role, content) VALUES (?, 'user', ?)", (session_id, query))
        conn.execute("INSERT INTO messages (session_id, role, content, latency_ms, model_used, faithfulness_score, retrieved_chunks) VALUES (?, 'assistant', ?, ?, ?, ?, ?)",
                   (session_id, full_answer, llm_response["latency_ms"], llm_response["model_used"], metrics["faithfulness"], json.dumps(chunk_data)))
        conn.commit()
        conn.close()

        # Yield metadata event at the end
        metadata = {
            "type": "metadata",
            "chunks": chunk_data,
            "session_id": session_id,
            "cache_hit": False,
            "model_used": llm_response["model_used"],
            "metrics": metrics
        }
        yield f"data: {json.dumps(metadata)}\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream', headers={'X-Session-ID': session_id})

@app.route('/sessions', methods=['GET'])
@token_required
def get_sessions(current_user_id):
    db = get_db()
    sessions = db.execute("""
        SELECT s.session_id, s.title, s.created_at, s.doc_id, d.filename 
        FROM sessions s JOIN documents d ON s.doc_id = d.doc_id 
        WHERE s.user_id = ? ORDER BY s.created_at DESC
    """, (current_user_id,)).fetchall()
    return jsonify([dict(s) for s in sessions])

@app.route('/session/<session_id>', methods=['GET'])
@token_required
def get_session_history(current_user_id, session_id):
    db = get_db()
    s = db.execute("SELECT * FROM sessions WHERE session_id = ? AND user_id = ?", (session_id, current_user_id)).fetchone()
    if not s:
        return jsonify({"error": "Not found"}), 404
        
    messages = db.execute("SELECT role, content, latency_ms, model_used, faithfulness_score, retrieved_chunks FROM messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,)).fetchall()
    
    res = []
    for m in messages:
        item = dict(m)
        if item["retrieved_chunks"]:
            try:
                item["retrieved_chunks"] = json.loads(item["retrieved_chunks"])
            except Exception:
                item["retrieved_chunks"] = []
        res.append(item)
    return jsonify(res)

@app.route('/metrics', methods=['GET'])
@token_required
def get_metrics(current_user_id):
    db = get_db()
    metrics = db.execute("""
        SELECT AVG(latency_ms) as avg_latency, AVG(faithfulness_score) as avg_faithfulness, model_used, COUNT(*) as count 
        FROM messages m JOIN sessions s ON m.session_id = s.session_id 
        WHERE s.user_id = ? AND role = 'assistant' 
        GROUP BY model_used
    """, (current_user_id,)).fetchall()
    return jsonify([dict(m) for m in metrics])

@app.route('/chunks/<doc_id>', methods=['GET'])
@token_required
def get_chunks(current_user_id, doc_id):
    db = get_db()
    doc = db.execute("SELECT * FROM documents WHERE doc_id = ? AND user_id = ?", (doc_id, current_user_id)).fetchone()
    if not doc:
        return jsonify({"error": "Access denied"}), 403
        
    chunks = db.execute("SELECT * FROM chunks WHERE doc_id = ?", (doc_id,)).fetchall()
    return jsonify([dict(c) for c in chunks])

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
