import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';

// Nav item definitions per role
const ADMIN_LINKS = [
  { to: '/admin/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/admin/users',     icon: '👥', label: 'Users' },
  { to: '/invoices',        icon: '🧾', label: 'Invoices' },
  { to: '/admin/cashout',   icon: '💰', label: 'Cash Out' },
  { to: '/admin/audit-logs',icon: '📋', label: 'Audit Logs' },
];

const USER_LINKS = [
  { to: '/invoices/upload', icon: '⬆', label: 'Upload Invoice' },
  { to: '/invoices',        icon: '🧾', label: 'My Invoices' },
  { to: '/cashout',         icon: '💰', label: 'Cash Out' },
];

/**
 * Shared sidebar for all pages.
 * @param {string} activePath - the current page path, used to highlight the active link
 */
export default function Sidebar({ activePath }) {
  const { isAdmin, userClaims, userData, logout } = useAuth();
  const navigate = useNavigate();
  const links = isAdmin ? ADMIN_LINKS : USER_LINKS;

  const shopLabel = userClaims?.shopName || userData?.shopName || '';

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  // Build initials for avatar
  const displayName = shopLabel || (isAdmin ? 'Admin' : 'User');
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-icon">🧾</div>
        <span>Big Basket Shop</span>
      </div>

      <nav className="sidebar__nav">
        {links.map(({ to, icon, label }) => (
          <Link
            key={to}
            to={to}
            className={`sidebar__link${activePath === to ? ' sidebar__link--active' : ''}`}
          >
            <span className="sidebar__icon">{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar__theme">
        <ThemeToggle compact />
      </div>

      {shopLabel && (
        <div className="sidebar__user-info">
          <div className="sidebar__avatar">{initials}</div>
          <span className="sidebar__user-name">{shopLabel}</span>
        </div>
      )}

      <button className="sidebar__logout" onClick={handleLogout}>
        <span className="sidebar__icon">↩</span>
        <span>Sign Out</span>
      </button>
    </aside>
  );
}
