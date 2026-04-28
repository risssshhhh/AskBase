import os
import uuid
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

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize DB
with app.app_context():
    init_db()

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

@app.route('/chat', methods=['POST'])
@token_required
def chat(current_user_id):
    data = request.json
    query = data.get('query')
    doc_id = data.get('doc_id')
    session_id = data.get('session_id')
    
    db = get_db()
    
    # Verification and setup
    doc = db.execute("SELECT * FROM documents WHERE doc_id = ? AND user_id = ?", (doc_id, current_user_id)).fetchone()
    if not doc:
        return jsonify({"error": "Document not found or access denied"}), 403
        
    if not session_id:
        session_id = str(uuid.uuid4())
        db.execute("INSERT INTO sessions (session_id, user_id, doc_id, title) VALUES (?, ?, ?, ?)",
                   (session_id, current_user_id, doc_id, query[:50]))
        db.commit()

    # Retrieve history
    history_rows = db.execute("SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 6", (session_id,)).fetchall()
    history = [{"role": row["role"], "content": row["content"]} for row in history_rows]

    # RAG Retrieval
    retriever = HybridRetriever(doc_id)
    retrieved_chunk_ids = retriever.retrieve(query, top_k=20)
    
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
                "section": c["section"]
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
            yield chunk
            
        # Post-generation: Evaluation & DB saving
        metrics = evaluate_rag(query, full_answer, chunk_data)
        
        conn = get_db()
        conn.execute("INSERT INTO messages (session_id, role, content) VALUES (?, 'user', ?)", (session_id, query))
        conn.execute("INSERT INTO messages (session_id, role, content, latency_ms, model_used, faithfulness_score) VALUES (?, 'assistant', ?, ?, ?, ?)",
                   (session_id, full_answer, llm_response["latency_ms"], llm_response["model_used"], metrics["faithfulness"]))
        conn.commit()
        conn.close()

    return Response(stream_with_context(generate()), mimetype='text/plain', headers={'X-Session-ID': session_id, 'X-Chunks': str([c['chunk_id'] for c in chunk_data])})

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
    # verify owner
    s = db.execute("SELECT * FROM sessions WHERE session_id = ? AND user_id = ?", (session_id, current_user_id)).fetchone()
    if not s:
        return jsonify({"error": "Not found"}), 404
        
    messages = db.execute("SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC", (session_id,)).fetchall()
    return jsonify([dict(m) for m in messages])

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
