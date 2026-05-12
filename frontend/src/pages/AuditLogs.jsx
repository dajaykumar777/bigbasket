import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar from '../components/Sidebar';

const PAGE_SIZE = 20;

const ACTION_LABELS = {
  ADMIN_LOGIN:        '🔐 Admin Login',
  USER_LOGIN:         '✅ User Login',
  USER_LOGIN_FAILED:  '❌ Login Failed',
  USER_CREATED:       '➕ User Created',
  USER_UPDATED:       '✏️ User Updated',
  USER_DISABLED:      '🚫 User Disabled',
  USER_DELETED:       '🗑️ User Deleted',
  USER_PIN_RESET:     '🔑 PIN Reset',
  INVOICE_UPLOADED:   '📤 Invoice Uploaded',
  INVOICE_MANUAL:     '✏️ Invoice Manual',
  INVOICE_UPDATED:    '📝 Invoice Updated',
  CASHOUT_SUBMITTED:  '💰 Cash Out Submitted',
};

// Human-readable labels for detail field keys
const DETAIL_LABELS = {
  invoiceNumber: 'Invoice Number',
  vendorName:    'Vendor',
  amount:        'Amount (£)',
  invoiceDate:   'Invoice Date',
  shopName:      'Shop',
  username:      'Username',
  fullName:      'Full Name',
  newStatus:     'New Status',
  entryMode:     'Entry Mode',
};

export default function AuditLogs() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [lastDoc, setLastDoc]     = useState(null);
  const [hasMore, setHasMore]     = useState(false);
  const [filter, setFilter]       = useState('');
  const [expanded, setExpanded]   = useState(null); // log id of expanded row

  async function fetchLogs(append = false) {
    setLoading(true);
    try {
      const constraints = [orderBy('timestamp', 'desc'), limit(PAGE_SIZE)];
      if (append && lastDoc) constraints.push(startAfter(lastDoc));
      const snap = await getDocs(query(collection(db, 'auditLogs'), ...constraints));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLogs((prev) => append ? [...prev, ...list] : list);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLogs(); }, []);

  const filtered = filter ? logs.filter((l) => l.action?.includes(filter)) : logs;

  function formatTs(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function badgeClass(action) {
    if (action?.includes('DELETED') || action?.includes('FAILED')) return 'badge--danger';
    if (action?.includes('DISABLED')) return 'badge--warning';
    if (action?.includes('LOGIN'))    return 'badge--info';
    return 'badge--success';
  }

  function displayName(log) {
    if (log.performedByName) return log.performedByName;
    if (log.performedByEmail) return log.performedByEmail;
    return log.performedBy ? log.performedBy.slice(0, 8) + '…' : '—';
  }

  function toggleExpand(id) {
    setExpanded((prev) => prev === id ? null : id);
  }

  return (
    <div className="layout">
      <Sidebar activePath="/admin/audit-logs" />

      <main className="main-content">
        <div className="page-header">
          <h2>Audit Logs</h2>
        </div>

        <div className="search-bar">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All actions</option>
            {Object.keys(ACTION_LABELS).map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>

        {loading && logs.length === 0 ? (
          <LoadingSpinner message="Loading logs…" />
        ) : filtered.length === 0 ? (
          <div className="empty-state">No audit logs found.</div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table audit-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Performed By</th>
                    <th>Time</th>
                    <th style={{ width: '60px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr
                        className={`audit-row ${expanded === log.id ? 'audit-row--open' : ''}`}
                        onClick={() => toggleExpand(log.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <span className={`badge ${badgeClass(log.action)}`}>
                            {ACTION_LABELS[log.action] || log.action?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td><strong>{displayName(log)}</strong></td>
                        <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{formatTs(log.timestamp)}</td>
                        <td style={{ textAlign: 'center', color: 'var(--gray-400)' }}>
                          {expanded === log.id ? '▲' : '▼'}
                        </td>
                      </tr>
                      {expanded === log.id && (
                        <tr className="audit-detail-row">
                          <td colSpan={4}>
                            <div className="audit-detail-panel">
                              <div className="audit-detail-grid">
                                <div className="audit-detail-item">
                                  <span className="audit-detail-label">Performed By</span>
                                  <span className="audit-detail-value">{displayName(log)}</span>
                                </div>
                                <div className="audit-detail-item">
                                  <span className="audit-detail-label">Action</span>
                                  <span className="audit-detail-value">{ACTION_LABELS[log.action] || log.action}</span>
                                </div>
                                <div className="audit-detail-item">
                                  <span className="audit-detail-label">Time</span>
                                  <span className="audit-detail-value">{formatTs(log.timestamp)}</span>
                                </div>
                                {log.targetId && (
                                  <div className="audit-detail-item">
                                    <span className="audit-detail-label">Record ID</span>
                                    <span className="audit-detail-value text-mono" style={{ fontSize: '0.78rem' }}>{log.targetId}</span>
                                  </div>
                                )}
                                {log.details && Object.entries(log.details).map(([k, v]) => (
                                  <div className="audit-detail-item" key={k}>
                                    <span className="audit-detail-label">{DETAIL_LABELS[k] || k}</span>
                                    <span className="audit-detail-value">{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="load-more">
                <button className="btn btn--ghost" onClick={() => fetchLogs(true)} disabled={loading}>
                  {loading ? <LoadingSpinner message="Loading…" /> : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

