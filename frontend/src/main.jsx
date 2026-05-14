import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';
import './styles/main.css';

// Apply saved theme before first render to avoid flash
const savedTheme = localStorage.getItem('bb-theme');
if (savedTheme === 'dark')  document.documentElement.setAttribute('data-theme', 'dark');
if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
// 'system' or unset: no attribute needed — CSS media query handles it

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
