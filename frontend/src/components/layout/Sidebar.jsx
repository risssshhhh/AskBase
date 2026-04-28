import React, { useState, useEffect } from 'react';
import { Upload, FileText, Plus, Loader2 } from 'lucide-react';
import { documentService } from '../../services/api';

function Sidebar({ sessions, setSessions, currentSessionId, setCurrentSessionId, setCurrentDocId }) {
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await documentService.getSessions();
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions", err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await documentService.upload(file);
      setCurrentDocId(res.doc_id);
      setCurrentSessionId(null); // start fresh session
      // Refresh sessions later when a chat is created
      alert("Document uploaded successfully. Start chatting!");
    } catch (err) {
      alert("Failed to upload document.");
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  };

  return (
    <aside style={{
      width: '260px',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>A</div>
          AskBase
        </h1>

        <label className="btn btn-primary" style={{ width: '100%', cursor: 'pointer' }}>
          {isUploading ? <Loader2 size={16} className="animate-spin" style={{ marginRight: '0.5rem' }} /> : <Upload size={16} style={{ marginRight: '0.5rem' }} />}
          {isUploading ? 'Uploading...' : 'Upload Document'}
          <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} accept=".pdf,.docx,.txt,.md" disabled={isUploading} />
        </label>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
          Recent Sessions
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {sessions.map(session => (
            <button
              key={session.session_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: currentSessionId === session.session_id ? 'var(--bg-tertiary)' : 'transparent',
                color: currentSessionId === session.session_id ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.2s ease',
              }}
              onClick={() => {
                setCurrentSessionId(session.session_id);
                // Also need to set the docId for this session, it should come from the session object
                // wait, the backend doesn't return doc_id in GET /sessions? Ah it only returns session_id, title, created_at, filename. Let's fix that later or just pass it down
                // Actually if I resume a session, I might just need the session_id to chat, doc_id is needed to retrieve chunks but router already has doc_id in DB linked to session.
                // Wait, chat endpoint expects doc_id... ah! 
                // Let's modify backend to return doc_id in /sessions or chat to fetch doc_id from session if not provided.
              }}
            >
              <FileText size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {session.title || 'New Chat'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {session.filename}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
