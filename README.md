# AskBase v2 — Production-Grade RAG Platform

AskBase is a multi-tenant document intelligence platform and full RAG research engine. It features an advanced hybrid retrieval pipeline, re-ranking layer, dynamic LLM router, and real-time response evaluation, all paired with a premium Vite + React frontend dashboard.

---

## 🧱 Architecture Overview

```
User ──> React Frontend ──> Flask REST API ──> RAG Pipeline ──> LLM Router
                                                 │
                                     FAISS + BM25 Hybrid Index
                                                 │
                                      Re-ranker (Cross-Encoder)
                                                 │
                                    Groq (LLaMA-3) / Gemini Fallback
```

---

## ✨ Features

- **Multi-Tenant Architecture:** Secure user signup, login, and tenant separation with JWT authentication.
- **Document Ingestion Pipeline:** Extracted structural text parsing from PDF (`PyMuPDF`) and DOCX (`python-docx`).
- **Semantic Text Chunking:** Sentence boundary-aware semantic chunking powered by `spaCy` to preserve contextual unity.
- **Hybrid Retrieval Pipeline:** Combines dense retrieval (embeddings generated using Hugging Face's `sentence-transformers` stored in a FAISS index) and sparse keyword retrieval (`rank_bm25`).
- **Reciprocal Rank Fusion (RRF):** Merges dense and sparse retrieval ranks using standard fusion scores to optimize recall.
- **Cross-Encoder Re-ranking:** Re-ranks the fused chunks using the state-of-the-art `cross-encoder/ms-marco-MiniLM-L-6-v2` transformer model to surface the top 5 candidates.
- **Dynamic LLM Router:** Queries the primary LLaMA-3 model via Groq APIs with low-latency streaming and automatically falls back to Gemini API if rate limits or errors occur.
- **Real-Time Evaluation:** Automatically evaluates every generated answer on *Faithfulness* and *Answer Relevance* metrics using sentence overlap and embedding distances.
- **Interactive UI Dashboard:** Implements dark/light mode toggle, collapsible sidebar for document uploads and chat history, an active workspace for real-time streaming chat, a sidebar displaying exact highlighted citations/sources, and an analytics pane for visualizing RAG pipeline health.

---

## 📁 Repository Structure

- [docker-compose.yml](file:///Users/rishita/Desktop/AskBase/docker-compose.yml): The multi-container service orchestrator for backend and frontend.
- [.env.example](file:///Users/rishita/Desktop/AskBase/.env.example): Reference configuration template for the required environment API keys.
- **`backend/`**
  - [backend/app.py](file:///Users/rishita/Desktop/AskBase/backend/app.py): Entrypoint Flask API setting up routing, streaming utilities, and middleware.
  - [backend/requirements.txt](file:///Users/rishita/Desktop/AskBase/backend/requirements.txt): Backend Python package specifications.
  - [backend/Dockerfile](file:///Users/rishita/Desktop/AskBase/backend/Dockerfile): Container builds for Flask.
  - **`backend/src/`**
    - [auth.py](file:///Users/rishita/Desktop/AskBase/backend/src/auth.py): User authentication logic, password hashing, and JWT token handling.
    - [db.py](file:///Users/rishita/Desktop/AskBase/backend/src/db.py): SQLite helper initializing the DB tables (`users`, `documents`, `sessions`, `messages`, `chunks`).
    - [ingestion.py](file:///Users/rishita/Desktop/AskBase/backend/src/ingestion.py): Handles PyMuPDF, python-docx parsing, and spaCy semantic chunking.
    - [retrieval.py](file:///Users/rishita/Desktop/AskBase/backend/src/retrieval.py): Implements BM25, sentence-transformer embedding indexation, FAISS vector database queries, and Reciprocal Rank Fusion (RRF).
    - [reranker.py](file:///Users/rishita/Desktop/AskBase/backend/src/reranker.py): Integrates Hugging Face Cross-Encoder model.
    - [router.py](file:///Users/rishita/Desktop/AskBase/backend/src/router.py): Governs streaming response synthesis from Groq or Gemini.
    - [evaluation.py](file:///Users/rishita/Desktop/AskBase/backend/src/evaluation.py): Runs RAG evaluation metrics to track response accuracy.
- **`frontend/`**
  - [frontend/package.json](file:///Users/rishita/Desktop/AskBase/frontend/package.json): Frontend dependencies, containing React, Recharts, and styling settings.
  - [frontend/vite.config.js](file:///Users/rishita/Desktop/AskBase/frontend/vite.config.js): Bundler settings.
  - `frontend/src/`: Core UI components (Sidebar, chat panel, source/citation inspector, and the analytics dashboard).

---

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed on your local machine:
- [Docker](https://www.docker.com/) (including Docker Compose)
- A Groq API Key and a Gemini API Key

### Configuration
1. Copy the sample environment file to create your active `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your credential values:
   ```env
   GROQ_API_KEY=gsk_your_groq_key_here
   GEMINI_API_KEY=AIzaSy_your_gemini_key_here
   JWT_SECRET=generate_a_secure_random_key
   ```

### Run the App
To compile the containers and start the application services:
```bash
docker-compose up --build
```

- **React Frontend**: accessible at [http://localhost:5173](http://localhost:5173)
- **Flask REST API**: accessible at [http://localhost:5000](http://localhost:5000)

> [!NOTE]
> On the first startup, the backend container will download transformer models (`sentence-transformers` and `cross-encoders`) to build the indexing environment. Depending on your network speed, this first boot may take 2-5 minutes.

---

## 🛠️ API Reference

### Authentication Endpoints
- **POST** `/api/auth/register`
  Registers a new user tenant.
  - Body: `{"username": "user", "password": "password"}`
- **POST** `/api/auth/login`
  Authenticates a user and returns a JWT token.
  - Body: `{"username": "user", "password": "password"}`
  - Returns: `{"token": "JWT_TOKEN", "username": "user"}`

### Document Endpoints
- **POST** `/api/documents/upload` (Requires JWT)
  Uploads a PDF, DOCX, TXT, or Markdown document.
  - Body: `multipart/form-data` containing the file under key `file`.
- **GET** `/api/documents` (Requires JWT)
  Lists all documents uploaded by the current user.

### Chat & Sessions Endpoints
- **POST** `/api/sessions` (Requires JWT)
  Creates a new conversation session.
- **GET** `/api/sessions` (Requires JWT)
  Retrieves all session histories for the logged-in user.
- **POST** `/api/chat` (Requires JWT)
  Initiates a streaming RAG conversation query.
  - Body: `{"session_id": "uuid", "query": "your question"}`
  - Returns: Server-Sent Events (SSE) data stream of the generated answer, metadata, and citation IDs.

### Analytics Endpoints
- **GET** `/api/analytics` (Requires JWT)
  Retrieves performance tracking statistics (response latency, total tokens, average faithfulness and relevance scores).

---

## 🧪 Development & Local Verification

### Running Backend Tests
Ensure python dependencies are installed locally and execute pytest:
```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
pytest
```

### Manual Verification
1. Open the UI dashboard, register a new profile, and sign in.
2. Drag and drop a document (e.g. a PDF research paper) in the sidebar.
3. Submit a specific query. Watch the chat stream the reply in real time.
4. Click on highlight tags inside the response to view exact matching source chunks in the panel.
5. Open the **Analytics** panel in the navigation to verify average latency and faithfulness metrics are recorded.
