// src/components/LandingPage/LandingPage.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './LandingPage.css'; // Create this CSS file

const LoginModal = ({ onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: loginError } = await login(email, password);
      if (loginError) throw loginError;
      onLoginSuccess(); // Callback to navigate in parent
    } catch (err) {
      setError(err.message || 'Failed to log in. Please check your credentials.');
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        <h2>Log In</h2>
        <form onSubmit={handleLoginSubmit}>
          {error && <p className="auth-error">{error}</p>}
          <div className="form-group">
            <label htmlFor="login-email">Email:</label>
            <input type="email" id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password:</label>
            <input type="password" id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
};


const LandingPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth(); // Get user and loading state

  // Effect to redirect if user becomes available (e.g. already logged in from a previous session)
  // This is handled by PublicRoute now, but good to be aware of.
  // if (loading) return <div>Loading...</div>; // Handled by PublicRoute
  // if (user) return <Navigate to="/plans" replace />; // Handled by PublicRoute

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const handleLoginSuccess = () => {
    closeLoginModal();
    navigate('/plans'); // Navigate after successful login
  };

  return (
    <div className="landing-container">
      <header className="landing-header">
        <img src="/logo.png" alt="App Logo" className="logo" /> {/* Replace with your logo path */}
        <button onClick={openLoginModal} className="login-btn-header">Log In</button>
      </header>
      <main className="landing-main">
        <h1>Plan Your Services, Together.</h1>
        <p>The simple way for musicians and organizers to coordinate church events.</p>
        <Link to="/start" className="get-started-btn">Get Started</Link>
      </main>
      {isLoginModalOpen && <LoginModal onClose={closeLoginModal} onLoginSuccess={handleLoginSuccess} />}
    </div>
  );
};

export default LandingPage;