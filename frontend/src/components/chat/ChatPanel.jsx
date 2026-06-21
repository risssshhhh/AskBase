import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2, Sparkles, Check } from 'lucide-react';
import { documentService } from '../../services/api';

function ChatPanel({ currentSessionId, selectedDocIds, setActiveSources, setCurrentSessionId }) {
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
      // Auto-set citations to the last assistant response
      const assistantMsgs = history.filter(m => m.role === 'assistant');
      if (assistantMsgs.length > 0) {
        const lastMsg = assistantMsgs[assistantMsgs.length - 1];
        setActiveSources(lastMsg.retrieved_chunks || []);
      } else {
        setActiveSources([]);
      }
    } catch (err) {
      console.error("Failed to load chat history", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleMessageClick = (msg) => {
    if (msg.role === 'assistant' && msg.retrieved_chunks) {
      setActiveSources(msg.retrieved_chunks);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    if (selectedDocIds.length === 0 && !currentSessionId) {
      alert("Please select at least one document from the Context Library first.");
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    const token = localStorage.getItem('askbase_token');
    
    // Add placeholder assistant message
    setMessages(prev => [...prev, { role: 'assistant', content: '', model_used: 'Searching context...' }]);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: input,
          doc_ids: selectedDocIds,
          session_id: currentSessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const returnedSessionId = response.headers.get('X-Session-ID');
      if (returnedSessionId && returnedSessionId !== currentSessionId) {
        setCurrentSessionId(returnedSessionId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Save remaining partial line
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === "token") {
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                newMessages[lastIndex] = {
                  ...newMessages[lastIndex],
                  content: newMessages[lastIndex].content + data.content
                };
                return newMessages;
              });
            } else if (data.type === "metadata") {
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                newMessages[lastIndex] = {
                  ...newMessages[lastIndex],
                  model_used: data.model_used,
                  cache_hit: data.cache_hit,
                  retrieved_chunks: data.chunks,
                  metrics: data.metrics
                };
                return newMessages;
              });

              if (data.chunks) {
                setActiveSources(data.chunks);
              }
            }
          } catch (e) {
            console.error("SSE JSON parsing error:", e);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        newMessages[lastIndex] = {
          ...newMessages[lastIndex],
          content: "Sorry, an error occurred while streaming response context. Please check backend connection.",
          model_used: "Error"
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
            <p>Select context files and enter a query to begin research.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                onClick={() => handleMessageClick(msg)}
                style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  backgroundColor: msg.role === 'assistant' ? 'var(--bg-secondary)' : 'transparent',
                  padding: '1.5rem',
                  borderRadius: '0.75rem',
                  border: msg.role === 'assistant' ? '1px solid var(--border-color)' : 'none',
                  boxShadow: msg.role === 'assistant' ? 'var(--shadow-sm)' : 'none',
                  cursor: msg.role === 'assistant' ? 'pointer' : 'default',
                  transition: 'background 0.2s ease',
                }}
                title={msg.role === 'assistant' ? "Click to view sources for this response" : undefined}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  backgroundColor: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ color: 'var(--text-primary)', lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                  
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>
                        Model: {msg.model_used}
                      </span>
                      {msg.cache_hit && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', backgroundColor: 'var(--accent-subtle)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Sparkles size={12} />
                          ⚡ Cached Response
                        </span>
                      )}
                      {msg.metrics && msg.metrics.faithfulness !== undefined && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>
                          Faithfulness: {msg.metrics.faithfulness.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
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
            placeholder="Ask a question across selected documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating || (selectedDocIds.length === 0 && !currentSessionId)}
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
