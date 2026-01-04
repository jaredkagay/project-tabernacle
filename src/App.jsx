// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import PlanPage from './components/PlanPage/PlanPage';
import AllPlansPage from './components/AllPlansPage/AllPlansPage';
import LandingPage from './components/LandingPage/LandingPage';
import StartPage from './components/StartPage/StartPage';
import SettingsPage from './components/SettingsPage/SettingsPage';
import TasksPage from './components/TasksPage/TasksPage';
import SongsPage from './components/SongsPage/SongsPage';
import TaskDetailPage from './components/TasksPage/TaskDetailPage';
import TaskResultsPage from './components/TasksPage/TaskResultsPage';
import DefaultPlanPage from './components/SettingsPage/DefaultPlanPage';
import HomePage from './components/HomePage/HomePage';
import { FaCog, FaCalendarAlt, FaTasks, FaMusic } from 'react-icons/fa';
import './App.css';

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
  return !user ? children : <Navigate to="/home" replace />;
}

// Helper to highlight active link
const NavLink = ({ to, icon, label }) => {
    const location = useLocation();
    const isActive = location.pathname.startsWith(to);
    
    return (
        <Link to={to} className={`nav-icon-link ${isActive ? 'active' : ''}`} title={label}>
            {icon}
        </Link>
    );
};

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
          <nav className="glass-nav">
            {/* LEFT: Logo + Nav Links (Docked together) */}
            <div className="nav-left">
              <Link to="/home" className="nav-logo-link">
                <img src="/logo.png" alt="Logo" className="nav-logo" />
              </Link>
              
              <div className="nav-links-container">
                  <NavLink to="/plans" label="Plans" icon={<FaCalendarAlt />} />
                  <NavLink to="/tasks" label="Tasks" icon={<FaTasks />} />
                  <NavLink to="/songs" label="Songs" icon={<FaMusic />} />
              </div>
            </div>

            {/* RIGHT: User Actions */}
            <div className="nav-right">
              {profile && <span className="hello-message hidden-mobile">{getGreeting()}, {profile.first_name}</span>}
              
              <Link to="/settings" className="nav-icon-link settings-link" title="Settings">
                <FaCog />
              </Link>
              
              <button onClick={logout} className="glass-logout-btn">Logout</button>
            </div>
          </nav>
        )}

        <Routes>
          <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
          <Route path="/start" element={<PublicRoute><StartPage /></PublicRoute>} />
          
          <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          
          <Route path="/plans" element={<ProtectedRoute><AllPlansPage /></ProtectedRoute>} />
          <Route path="/plan/:planId" element={<ProtectedRoute><PlanPage /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
          <Route path="/task/:assignmentId" element={<ProtectedRoute><TaskDetailPage /></ProtectedRoute>} />
          <Route path="/task-results/:taskId" element={<ProtectedRoute><TaskResultsPage /></ProtectedRoute>} />
          <Route path="/songs" element={<ProtectedRoute><SongsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/settings/default-plan" element={<ProtectedRoute><DefaultPlanPage /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to={user ? "/home" : "/"} replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;