import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { analyticsService } from '../../services/api';

function AnalyticsPanel() {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const data = await analyticsService.getMetrics();
      // data: [{model_used: 'llama3...', avg_latency: 1200, avg_faithfulness: 0.9, count: 5}]
      setMetrics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading metrics...</div>;
  }

  if (metrics.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>No analytics data available yet. Start chatting to generate data.</div>;
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
      <h2 style={{ marginBottom: '2rem', fontSize: '1.5rem', fontWeight: 700 }}>AskBase Analytics</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Latency by Model */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>Average Latency (ms)</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="model_used" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }} />
                <Legend />
                <Bar dataKey="avg_latency" fill="var(--accent-primary)" name="Latency (ms)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Faithfulness by Model */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>Average Faithfulness Score</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="model_used" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" domain={[0, 1]} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }} />
                <Legend />
                <Bar dataKey="avg_faithfulness" fill="#10b981" name="Faithfulness" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Usage Count by Model */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>Model Usage Count</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="model_used" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }} />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" name="Queries Handled" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AnalyticsPanel;
