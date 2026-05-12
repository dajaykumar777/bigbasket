import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RoleSelection() {
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();

  React.useEffect(() => {
    if (currentUser && role === 'admin') navigate('/admin/dashboard');
    if (currentUser && role === 'user')  navigate('/invoices/upload');
  }, [currentUser, role, navigate]);

  return (
    <div className="home-page">
      {/* Left panel – branding */}
      <div className="home-panel home-panel--brand">
        <div className="home-brand">
          <div className="home-brand__icon">🧾</div>
          <h1 className="home-brand__name">Big Basket Shop</h1>
          <p className="home-brand__tagline">Invoice &amp; Cash Management</p>
        </div>

        <ul className="home-features">
          <li><span>📤</span> Upload invoices via photo or manual entry</li>
          <li><span>💰</span> End-of-day cash &amp; card reconciliation</li>
          <li><span>📊</span> Admin dashboard with real-time totals</li>
          <li><span>📋</span> Full audit trail of all actions</li>
        </ul>

        <p className="home-copy">&copy; {new Date().getFullYear()} Big Basket Shop</p>
      </div>

      {/* Right panel – login options */}
      <div className="home-panel home-panel--login">
        <div className="home-login-card">
          <h2 className="home-login-card__title">Welcome back</h2>
          <p className="home-login-card__sub">Sign in to your account</p>

          <div className="home-login-options">
            <button
              className="home-login-btn home-login-btn--admin"
              onClick={() => navigate('/admin/login')}
            >
              <div className="home-login-btn__icon-wrap">🔐</div>
              <div className="home-login-btn__text">
                <strong>Admin</strong>
                <span>Manage users, invoices &amp; reports</span>
              </div>
              <span className="home-login-btn__arrow">→</span>
            </button>

            <button
              className="home-login-btn home-login-btn--staff"
              onClick={() => navigate('/user/login')}
            >
              <div className="home-login-btn__icon-wrap">👤</div>
              <div className="home-login-btn__text">
                <strong>Staff</strong>
                <span>Upload invoices &amp; submit cash out</span>
              </div>
              <span className="home-login-btn__arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
