import React, { useState, useEffect } from 'react';
import { LogOut, Moon, Sun, BarChart2, MessageSquare } from 'lucide-react';
import { authService } from './services/api';
import Sidebar from './components/layout/Sidebar';
import ChatPanel from './components/chat/ChatPanel';
import SourcePanel from './components/chat/SourcePanel';
import AnalyticsPanel from './components/analytics/AnalyticsPanel';
import AuthModal from './components/AuthModal';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [theme, setTheme] = useState('light');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'analytics'
  
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [activeSources, setActiveSources] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('askbase_token');
    if (token) {
      setIsAuthenticated(true);
    }
    
    // Check system preference for theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setSessions([]);
    setCurrentSessionId(null);
    setSelectedDocIds([]);
  };

  if (!isAuthenticated) {
    return <AuthModal onAuthSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-container">
      <Sidebar 
        sessions={sessions} 
        setSessions={setSessions}
        currentSessionId={currentSessionId}
        setCurrentSessionId={setCurrentSessionId}
        selectedDocIds={selectedDocIds}
        setSelectedDocIds={setSelectedDocIds}
      />
      
      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className={`btn ${activeTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={16} style={{ marginRight: '0.5rem' }} />
              Chat
            </button>
            <button 
              className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart2 size={16} style={{ marginRight: '0.5rem' }} />
              Analytics
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button className="btn btn-secondary" onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {activeTab === 'chat' ? (
            <>
              <ChatPanel 
                currentSessionId={currentSessionId} 
                selectedDocIds={selectedDocIds}
                setActiveSources={setActiveSources}
                setCurrentSessionId={setCurrentSessionId}
              />
              <SourcePanel sources={activeSources} />
            </>
          ) : (
            <AnalyticsPanel />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
