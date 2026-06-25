import React, { useEffect, Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Header from './components/layout/Header';
import Navigation from './components/layout/Navigation';
import InsightsPage from './pages/InsightsPage';
import ClaimsPage from './pages/ClaimsPage';
import AgingPage from './pages/AgingPage';
import SettingsPage from './pages/SettingsPage';
import { api } from './api/client';
import { useStore, sessionId } from './store/useStore';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0d1117', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ background: '#161b22', border: '1px solid #da3633', borderRadius: 12, padding: 32, maxWidth: 700, width: '100%' }}>
            <h2 style={{ color: '#f85149', fontFamily: 'monospace', marginBottom: 12 }}>Application Error</h2>
            <pre style={{ color: '#e6edf3', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {(this.state.error as Error).message}
              {'\n\n'}
              {(this.state.error as Error).stack}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const { theme } = useStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    api.trackVisit(sessionId).catch(() => {});
  }, []);

  useQuery({
    queryKey: ['visitors', 'today'],
    queryFn: api.getTodayVisitors,
    refetchInterval: 60_000,
  });

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg-base flex flex-col">
        <Header />
        <Navigation />
        <main className="flex-1 p-6 max-w-screen-2xl mx-auto w-full animate-fade-in">
          <Routes>
            <Route path="/" element={<InsightsPage />} />
            <Route path="/claims" element={<ClaimsPage />} />
            <Route path="/aging" element={<AgingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
