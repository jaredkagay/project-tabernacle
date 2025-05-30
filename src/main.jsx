// src/main.jsx (Vite example)
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // Assuming App.jsx if using Vite conventions
import './index.css';
import { AuthProvider } from './contexts/AuthContext.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);