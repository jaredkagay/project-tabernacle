// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import PlanPage from './components/PlanPage/PlanPage';
import AllPlansPage from './components/AllPlansPage/AllPlansPage';
import LandingPage from './components/LandingPage/LandingPage';
import StartPage from './components/StartPage/StartPage';
import SettingsPage from './components/SettingsPage/SettingsPage';
import TasksPage from './components/TasksPage/TasksPage';
import SongsPage from './components/SongsPage/SongsPage';
import './App.css';
import TaskDetailPage from './components/TasksPage/TaskDetailPage';
import TaskResultsPage from './components/TasksPage/TaskResultsPage';
import DefaultPlanPage from './components/SettingsPage/DefaultPlanPage';
import { FaCog } from 'react-icons/fa'; // Import the gear icon

// Component to protect routes
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading application...</div>;
  return user ? children : <Navigate to="/" replace />;
};

// Component for routes accessible only by public/logged-out users
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading application...</div>;
  return !user ? children : <Navigate to="/plans" replace />;
}

function App() {
  const { user, profile, logout, loading } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 24) return 'Good evening';
    return 'Good night';
  };

  if (loading) {
    return <div className="app-loading-message">Loading application...</div>;
  }

  return (
    <Router>
      <div className="App">
        {user && (
          <nav className="main-nav">
            <div className="nav-links">
              <Link to="/plans">
                <img src="/logo.png" alt="App Logo" className="nav-logo" />
              </Link>
              <Link to="/plans">Plans</Link>
              <Link to="/tasks">Tasks</Link>
              <Link to="/songs">Songs</Link>
            </div>
            <div className="nav-user-actions">
              {profile && <span className="hello-message">{getGreeting()}, {profile.first_name}</span>}
              <button onClick={logout} className="logout-btn">Logout</button>
              <Link to="/settings" className="settings-icon-link" title="Settings">
                <FaCog />
              </Link>
            </div>
          </nav>
        )}

        <Routes>
          <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
          <Route path="/start" element={<PublicRoute><StartPage /></PublicRoute>} />
          <Route path="/plans" element={<ProtectedRoute><AllPlansPage /></ProtectedRoute>} />
          <Route path="/plan/:planId" element={<ProtectedRoute><PlanPage /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
          <Route path="/task/:assignmentId" element={<ProtectedRoute><TaskDetailPage /></ProtectedRoute>} />
          <Route path="/task-results/:taskId" element={<ProtectedRoute><TaskResultsPage /></ProtectedRoute>} />
          <Route path="/songs" element={<ProtectedRoute><SongsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/settings/default-plan" element={<ProtectedRoute><DefaultPlanPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to={user ? "/plans" : "/"} replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;