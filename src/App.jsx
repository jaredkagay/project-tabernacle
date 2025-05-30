// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext'; // Import useAuth
import PlanPage from './components/PlanPage/PlanPage';
import AllPlansPage from './components/AllPlansPage/AllPlansPage';
import LandingPage from './components/LandingPage/LandingPage'; // We'll create this
import StartPage from './components/StartPage/StartPage';     // We'll create this
import './App.css';

// Component to protect routes
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading application...</div>; // Or a spinner
  return user ? children : <Navigate to="/" replace />;
};

// Component for routes accessible only by public/logged-out users
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading application...</div>; // Or a spinner
  return !user ? children : <Navigate to="/plans" replace />;
}

function App() {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return <div>Loading application...</div>; // Full screen loader while auth is resolving
  }

  return (
    <Router>
      <div className="App">
        {user && ( // Show nav only if user is logged in
          <nav className="main-nav">
            <Link to="/plans">All Plans</Link>
            <button onClick={logout} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
          </nav>
        )}

        <Routes>
          <Route path="/" element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          } />
          <Route path="/start" element={
            <PublicRoute>
              <StartPage />
            </PublicRoute>
          } />
          <Route path="/plans" element={
            <ProtectedRoute>
              <AllPlansPage />
            </ProtectedRoute>
          } />
          <Route path="/plan/:planId" element={
            <ProtectedRoute>
              <PlanPage />
            </ProtectedRoute>
          } />
          {/* Redirect any unknown paths, or show a 404 component */}
          <Route path="*" element={<Navigate to={user ? "/plans" : "/"} replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;