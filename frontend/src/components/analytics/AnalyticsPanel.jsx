import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
      setMetrics(data);
    } catch (err) {
      console.error("Failed to load metrics", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading pipeline metrics...</div>;
  }

  if (metrics.length === 0) {
    return (
      <div style={{ flex: 1, padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        No analytics data available yet. Start querying documents to collect RAG performance metrics.
      </div>
    );
  }

  // Calculate KPI values
  const totalQueries = metrics.reduce((acc, curr) => acc + curr.count, 0);
  const cacheEntry = metrics.find(m => m.model_used === 'semantic_cache');
  const cacheHits = cacheEntry ? cacheEntry.count : 0;
  const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0.0;
  
  // Estimate savings: assume ~1.5 cents saved per standard LLaMA-3/Mixtral API generation
  const estimatedSavings = (cacheHits * 0.015).toFixed(3);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', backgroundColor: 'var(--bg-primary)' }}>
      <h2 style={{ marginBottom: '2rem', fontSize: '1.5rem', fontWeight: 700 }}>Pipeline Analytics</h2>

      {/* KPI Cards Banner */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1.5rem', 
        marginBottom: '2.5rem' 
      }}>
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Queries</div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>{totalQueries}</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Cache Hits</div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>{cacheHits}</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Cache Efficiency</div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem' }}>{cacheHitRate.toFixed(1)}%</div>
        </div>
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>API Costs Saved</div>
          <div style={{ fontSize: '1.875rem', fontWeight: 700, color: '#8b5cf6', marginTop: '0.25rem' }}>${estimatedSavings}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        
        {/* Latency Chart */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>Avg Generation Latency (ms)</h3>
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

        {/* Faithfulness Score Chart */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>Avg Faithfulness Index</h3>
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

        {/* Usage Count Chart */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>Traffic Handled by Model Provider</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="model_used" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem' }} />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" name="Total Queries" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AnalyticsPanel;
