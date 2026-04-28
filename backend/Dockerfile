FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for build (e.g., PyMuPDF, FAISS)
RUN apt-get update && apt-get install -y \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Pre-download SentenceTransformer and CrossEncoder models to avoid downloading on runtime
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-mpnet-base-v2')"
RUN python -c "from transformers import CrossEncoder; CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', max_length=512)"

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
