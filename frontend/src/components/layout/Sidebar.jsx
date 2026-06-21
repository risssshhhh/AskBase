import React, { useState, useEffect } from 'react';
import { Upload, FileText, Plus, Loader2, CheckSquare } from 'lucide-react';
import { documentService } from '../../services/api';

function Sidebar({ sessions, setSessions, currentSessionId, setCurrentSessionId, selectedDocIds, setSelectedDocIds }) {
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    loadSessions();
    loadDocuments();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await documentService.getSessions();
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions", err);
    }
  };

  const loadDocuments = async () => {
    try {
      const docs = await documentService.getDocuments();
      setDocuments(docs);
      // Auto-select the most recent document if nothing is selected yet
      if (docs.length > 0 && selectedDocIds.length === 0) {
        setSelectedDocIds([docs[0].doc_id]);
      }
    } catch (err) {
      console.error("Failed to load documents", err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await documentService.upload(file);
      await loadDocuments();
      setSelectedDocIds([res.doc_id]);
      setCurrentSessionId(null); // start fresh session
      alert("Document uploaded and parsed successfully. Context auto-selected!");
    } catch (err) {
      console.error(err);
      alert("Failed to upload document.");
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  };

  const toggleDocSelection = (docId) => {
    if (selectedDocIds.includes(docId)) {
      if (selectedDocIds.length > 1) {
        setSelectedDocIds(selectedDocIds.filter(id => id !== docId));
      } else {
        alert("At least one document must remain selected for retrieval context.");
      }
    } else {
      setSelectedDocIds([...selectedDocIds, docId]);
    }
  };

  return (
    <aside style={{
      width: '280px',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>A</div>
          AskBase v2
        </h1>

        <label className="btn btn-primary" style={{ width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {isUploading ? <Loader2 size={16} className="animate-spin" style={{ marginRight: '0.5rem' }} /> : <Upload size={16} style={{ marginRight: '0.5rem' }} />}
          {isUploading ? 'Ingesting...' : 'Ingest Document'}
          <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} accept=".pdf,.docx,.txt,.md" disabled={isUploading} />
        </label>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Document Selection Section */}
        <div>
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '0.5rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckSquare size={12} />
            Context Library ({documents.length})
          </h3>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.375rem', 
            maxHeight: '180px', 
            overflowY: 'auto', 
            border: '1px solid var(--border-color)', 
            padding: '0.5rem', 
            borderRadius: '0.5rem', 
            backgroundColor: 'var(--bg-primary)' 
          }}>
            {documents.length === 0 ? (
              <div style={{ padding: '1rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                Upload files to build your RAG index.
              </div>
            ) : (
              documents.map(doc => (
                <label 
                  key={doc.doc_id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    padding: '0.375rem 0.5rem', 
                    borderRadius: '0.375rem', 
                    cursor: 'pointer', 
                    fontSize: '0.8125rem', 
                    transition: 'background 0.2s', 
                    backgroundColor: selectedDocIds.includes(doc.doc_id) ? 'var(--bg-secondary)' : 'transparent',
                    userSelect: 'none'
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedDocIds.includes(doc.doc_id)}
                    onChange={() => toggleDocSelection(doc.doc_id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: selectedDocIds.includes(doc.doc_id) ? 'var(--text-primary)' : 'var(--text-secondary)' }} title={doc.filename}>
                    {doc.filename}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Sessions Section */}
        <div>
          <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
            Recent Sessions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {sessions.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '0.5rem' }}>No recent chats.</div>
            ) : (
              sessions.map(session => (
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
                    width: '100%',
                    transition: 'background 0.2s ease',
                  }}
                  onClick={() => {
                    setCurrentSessionId(session.session_id);
                    if (session.doc_id) {
                      setSelectedDocIds([session.doc_id]);
                    }
                  }}
                >
                  <FileText size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <div style={{ overflow: 'hidden', width: '100%' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {session.title || 'New Chat'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {session.filename}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
