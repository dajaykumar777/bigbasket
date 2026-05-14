import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function RoleSelection() {
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    if (currentUser && role === 'admin') navigate('/admin/dashboard');
    if (currentUser && role === 'user')  navigate('/invoices/upload');
  }, [currentUser, role, navigate]);

  function goTo(path) {
    setLeaving(true);
    setTimeout(() => navigate(path), 260);
  }

  return (
    <div className={leaving ? 'home-page leaving' : 'home-page'}>
      {/* Theme toggle — top right */}
      <div className="home-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="home-center">
        {/* Branding */}
        <div className="home-brand">
          <div className="home-brand__icon">🧾</div>
          <h1 className="home-brand__name">Big Basket Shop</h1>
          <p className="home-brand__tagline">Invoice &amp; Cash Management</p>
        </div>

        {/* Login options */}
        <div className="home-login-card">
          <p className="home-login-card__sub">Sign in to your account</p>
          <div className="home-login-options">
            <button
              className="home-login-btn home-login-btn--admin"
              onClick={() => goTo('/admin/login')}
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
              onClick={() => goTo('/user/login')}
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

        <p className="home-copy">&copy; {new Date().getFullYear()} Big Basket Shop</p>
      </div>
    </div>
  );
}
