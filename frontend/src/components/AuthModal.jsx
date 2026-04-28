import React, { useState } from 'react';
import { authService } from '../services/api';

function AuthModal({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await authService.login(username, password);
        onAuthSuccess();
      } else {
        await authService.register(username, password);
        setIsLogin(true);
        setError('Registration successful. Please log in.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', 
      backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)'
    }}>
      <div className="glass" style={{
        padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '400px',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          AskBase {isLogin ? 'Login' : 'Register'}
        </h2>
        
        {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Username</label>
            <input 
              type="text" 
              className="input" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Password</label>
            <input 
              type="password" 
              className="input" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Register')}
          </button>
        </form>
        
        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
          >
            {isLogin ? 'Register' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default AuthModal;
