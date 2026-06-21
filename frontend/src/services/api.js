import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
});

// Add token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('askbase_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: async (username, password) => {
    const res = await api.post('/login', { username, password });
    if (res.data.token) {
      localStorage.setItem('askbase_token', res.data.token);
    }
    return res.data;
  },
  register: async (username, password) => {
    const res = await api.post('/register', { username, password });
    return res.data;
  },
  logout: () => {
    localStorage.removeItem('askbase_token');
  }
};

export const documentService = {
  upload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  getDocuments: async () => {
    const res = await api.get('/documents');
    return res.data;
  },
  getSessions: async () => {
    const res = await api.get('/sessions');
    return res.data;
  },
  getSessionHistory: async (sessionId) => {
    const res = await api.get(`/session/${sessionId}`);
    return res.data;
  }
};

export const analyticsService = {
  getMetrics: async () => {
    const res = await api.get('/metrics');
    return res.data;
  }
};

export default api;
