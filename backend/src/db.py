import sqlite3
import os

DB_PATH = os.environ.get("DB_PATH", "askbase.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Users table for multi-tenancy
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    """)

    # Documents table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            doc_id TEXT PRIMARY KEY,
            user_id INTEGER,
            filename TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    # Sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id INTEGER,
            doc_id TEXT,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(doc_id) REFERENCES documents(doc_id)
        )
    """)

    # Messages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            latency_ms REAL,
            model_used TEXT,
            faithfulness_score REAL,
            retrieved_chunks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES sessions(session_id)
        )
    """)

    # Chunks table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chunks (
            chunk_id TEXT PRIMARY KEY,
            doc_id TEXT,
            text TEXT NOT NULL,
            page INTEGER,
            section TEXT,
            char_offset INTEGER,
            FOREIGN KEY(doc_id) REFERENCES documents(doc_id)
        )
    """)

    # Semantic Cache table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS semantic_cache (
            cache_id TEXT PRIMARY KEY,
            user_id INTEGER,
            doc_id TEXT,
            query_text TEXT NOT NULL,
            query_embedding BLOB NOT NULL,
            answer_text TEXT NOT NULL,
            chunks_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(doc_id) REFERENCES documents(doc_id)
        )
    """)

    # Alter table messages to add retrieved_chunks if it doesn't exist (for existing databases)
    try:
        cursor.execute("ALTER TABLE messages ADD COLUMN retrieved_chunks TEXT")
    except sqlite3.OperationalError:
        pass

    # Alter table semantic_cache to add doc_id if not present
    try:
        cursor.execute("ALTER TABLE semantic_cache ADD COLUMN doc_id TEXT")
    except sqlite3.OperationalError:
        pass

    # Performance Indexing
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_user_doc ON semantic_cache(user_id, doc_id)")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized.")
