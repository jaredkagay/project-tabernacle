// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { supabase } from './supabaseClient.js';

// console.log('main.jsx: Application script started.'); // Optional: for very basic startup verification

(async () => {
  try {
    // console.log('[main.jsx] Attempting to get initial Supabase session before React renders...');
    await supabase.auth.getSession(); // Ensure client attempts to load session
    // console.log('[main.jsx] Initial Supabase session check/load attempted.');
  } catch (e) {
    console.error('[main.jsx] Error during pre-render Supabase session check:', e);
  } finally {
    // console.log('[main.jsx] Rendering React application...');
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(
        <React.StrictMode> {/* Keep StrictMode, it's good for development */}
          <AuthProvider>
            <App />
          </AuthProvider>
        </React.StrictMode>
      );
      // console.log('main.jsx: React application rendered successfully.');
    } catch (renderError) {
      console.error('main.jsx: CRITICAL ERROR during React initial render:', renderError);
      document.getElementById('root').innerHTML =
        '<div style="padding: 20px; text-align: center; font-family: sans-serif;">' +
        '<h1>Application Error</h1>' +
        '<p>Could not load the application. Please try again later.</p>' +
        '</div>';
    }
  }
})();