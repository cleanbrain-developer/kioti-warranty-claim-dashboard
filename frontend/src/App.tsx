import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Header from './components/layout/Header';
import Navigation from './components/layout/Navigation';
import InsightsPage from './pages/InsightsPage';
import ClaimsPage from './pages/ClaimsPage';
import AgingPage from './pages/AgingPage';
import { api } from './api/client';
import { sessionId } from './store/useStore';

export default function App() {
  // Track visitor on app load
  useEffect(() => {
    api.trackVisit(sessionId).catch(() => {});
  }, []);

  // Poll visitor count every 60 seconds
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
