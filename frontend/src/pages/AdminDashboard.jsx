import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, query, orderBy, limit, getDocs, getCountFromServer,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar from '../components/Sidebar';

export default function AdminDashboard() {
  const { logout } = useAuth();
  const navigate   = useNavigate();
  const [stats, setStats]     = useState(null);
  const [recent, setRecent]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [userSnap, invoiceSnap, logSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'invoices')),
          getCountFromServer(collection(db, 'auditLogs')),
        ]);

        setStats({
          users:    userSnap.data().count,
          invoices: invoiceSnap.data().count,
          logs:     logSnap.data().count,
        });

        // Recent audit logs
        const recentQ = query(
          collection(db, 'auditLogs'),
          orderBy('timestamp', 'desc'),
          limit(5)
        );
        const recentSnap = await getDocs(recentQ);
        setRecent(recentSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  function formatTs(ts) {
    if (!ts) return '—';
    return ts.toDate ? ts.toDate().toLocaleString() : new Date(ts).toLocaleString();
  }

  return (
    <div className="layout">
      <Sidebar activePath="/admin/dashboard" />

      <main className="main-content">
        <div className="page-header">
          <h2>Dashboard</h2>
          <p className="page-subtitle">Overview of your Big Basket Shop invoices</p>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading stats…" />
        ) : (
          <>
            {/* Stats cards */}
            <div className="stats-grid">
              <Link to="/admin/users" className="stat-card stat-card--link">
                <div className="stat-card__value">{stats?.users ?? 0}</div>
                <div className="stat-card__label">Total Users</div>
              </Link>
              <Link to="/invoices" className="stat-card stat-card--link">
                <div className="stat-card__value">{stats?.invoices ?? 0}</div>
                <div className="stat-card__label">Total Invoices</div>
              </Link>
              <Link to="/admin/audit-logs" className="stat-card stat-card--link">
                <div className="stat-card__value">{stats?.logs ?? 0}</div>
                <div className="stat-card__label">Audit Events</div>
              </Link>
            </div>

            {/* Quick links */}
            <div className="quick-actions">
              <Link to="/admin/users" className="btn btn--primary">
                + Add User
              </Link>
              <Link to="/invoices" className="btn btn--secondary">
                View Invoices
              </Link>
            </div>

            {/* Recent activity */}
            <section className="card">
              <h3 className="card__title">Recent Activity</h3>
              {recent.length === 0 ? (
                <p className="empty-state">No activity yet.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <span className={`badge badge--${badgeType(log.action)}`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="text-muted">{formatTs(log.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="card__footer">
                <Link to="/admin/audit-logs" className="link-btn">View all logs →</Link>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function badgeType(action) {
  if (action.includes('DELETED') || action.includes('FAILED'))  return 'danger';
  if (action.includes('DISABLED'))  return 'warning';
  if (action.includes('LOGIN'))     return 'info';
  return 'success';
}
