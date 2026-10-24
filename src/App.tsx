import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { AuthForm } from './components/AuthForm';
import { AdminPage } from './components/AdminPage';
import { AboutPage } from './components/AboutPage';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });
  const [queryString, setQueryString] = useState<string>(() => {
    return window.location.search || '';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      setQueryString(window.location.search || '');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (fullUrl: string) => {
    const [path, query] = fullUrl.split('?');
    window.history.pushState({}, '', fullUrl);
    setCurrentPath(path || '/');
    setQueryString(query ? `?${query}` : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Determine section from query string (e.g. ?section=integrations)
  const queryParams = new URLSearchParams(queryString);
  const requestedSection = queryParams.get('section') as
    | 'overview'
    | 'repositories'
    | 'findings'
    | 'integrations'
    | 'settings'
    | null;

  // Route routing
  if (currentPath === '/login') {
    return <AuthForm mode="login" onNavigate={navigate} />;
  }

  if (currentPath === '/register') {
    return <AuthForm mode="register" onNavigate={navigate} />;
  }

  if (currentPath === '/about') {
    return <AboutPage onNavigate={navigate} />;
  }

  if (currentPath === '/admin') {
    return <AdminPage onNavigate={navigate} />;
  }

  if (currentPath === '/dashboard') {
    return (
      <Dashboard
        initialSection={requestedSection || 'overview'}
        onNavigate={navigate}
      />
    );
  }

  // Default to landing page
  return <LandingPage onNavigate={navigate} />;
};
export default App;
