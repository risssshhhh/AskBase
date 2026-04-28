import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { documentService } from '../../services/api';
import API_URL from '../../services/api';

function ChatPanel({ currentSessionId, currentDocId, setActiveSources, setCurrentSessionId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (currentSessionId) {
      loadHistory();
    } else {
      setMessages([]);
      setActiveSources([]);
    }
  }, [currentSessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadHistory = async () => {
    try {
      const history = await documentService.getSessionHistory(currentSessionId);
      setMessages(history);
    } catch (err) {
      console.error(err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    if (!currentDocId && !currentSessionId) {
      alert("Please upload or select a document first.");
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    const token = localStorage.getItem('askbase_token');
    
    // Create a placeholder for assistant message
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: input,
          doc_id: currentDocId,
          session_id: currentSessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Check for headers (new session ID and retrieved chunks)
      const returnedSessionId = response.headers.get('X-Session-ID');
      if (returnedSessionId && returnedSessionId !== currentSessionId) {
        setCurrentSessionId(returnedSessionId);
      }

      const chunksHeader = response.headers.get('X-Chunks');
      if (chunksHeader) {
        // We'll decode this properly when needed or pass chunks directly via separate call
        // For simplicity, we just trigger fetching chunks in source panel if needed.
        // Actually, the headers approach might be tricky with CORS if not exposed.
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            content: newMessages[lastIndex].content + chunk
          };
          return newMessages;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        newMessages[lastIndex] = {
          ...newMessages[lastIndex],
          content: "Sorry, an error occurred while generating the response."
        };
        return newMessages;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', flexDirection: 'column', gap: '1rem' }}>
            <Bot size={48} />
            <p>Select a document and ask a question to begin.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                backgroundColor: msg.role === 'assistant' ? 'var(--bg-secondary)' : 'transparent',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                border: msg.role === 'assistant' ? '1px solid var(--border-color)' : 'none',
                boxShadow: msg.role === 'assistant' ? 'var(--shadow-sm)' : 'none',
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  backgroundColor: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div style={{ flex: 1, color: 'var(--text-primary)', lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)' }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
          <input
            type="text"
            className="input"
            placeholder="Ask a question about your document..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating || (!currentDocId && !currentSessionId)}
            style={{ paddingRight: '3rem', height: '3rem', borderRadius: '1.5rem' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            style={{
              position: 'absolute', right: '0.5rem', top: '0.5rem',
              width: '2rem', height: '2rem', borderRadius: '50%',
              backgroundColor: input.trim() && !isGenerating ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: input.trim() && !isGenerating ? 'white' : 'var(--text-tertiary)',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !isGenerating ? 'pointer' : 'default',
              transition: 'all 0.2s ease'
            }}
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} style={{ marginLeft: '-2px' }} />}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatPanel;
