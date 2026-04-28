import React from 'react';
import { BookOpen } from 'lucide-react';

function SourcePanel({ sources }) {
  if (!sources || sources.length === 0) {
    return (
      <div style={{
        width: '320px', backgroundColor: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)',
        padding: '1.5rem', display: 'flex', flexDirection: 'column', color: 'var(--text-tertiary)', alignItems: 'center', justifyContent: 'center'
      }}>
        <BookOpen size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
        <p style={{ textAlign: 'center', fontSize: '0.875rem' }}>Ask a question to see retrieved context chunks here.</p>
      </div>
    );
  }

  return (
    <div style={{
      width: '320px', backgroundColor: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)',
      display: 'flex', flexDirection: 'column', height: '100%'
    }}>
      <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={18} className="text-accent-primary" style={{ color: 'var(--accent-primary)' }} />
          Sources
        </h3>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {sources.map((source, idx) => (
          <div key={idx} style={{
            padding: '1rem', backgroundColor: 'var(--bg-primary)', borderRadius: '0.5rem',
            border: '1px solid var(--border-color)', fontSize: '0.875rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Chunk {idx + 1}</span>
              <span style={{ 
                backgroundColor: 'var(--accent-subtle)', color: 'var(--accent-primary)', 
                padding: '0.125rem 0.5rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600
              }}>
                Page {source.page}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
              {source.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SourcePanel;
