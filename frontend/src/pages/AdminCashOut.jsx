import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, query, orderBy, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import Toast, { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar from '../components/Sidebar';

const STORES = ['Chase Side', 'Ley Street'];

export default function AdminCashOut() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toast, showToast, clearToast } = useToast();

  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [storeFilter, setStoreFilter] = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [filtered, setFiltered]     = useState([]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'cashOuts'), orderBy('createdAt', 'desc'))
      );
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      showToast(`Failed to load: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Apply filters
  useEffect(() => {
    setFiltered(
      records.filter((r) => {
        const matchStore = !storeFilter || r.store === storeFilter;
        const matchFrom  = !dateFrom  || r.date >= dateFrom;
        const matchTo    = !dateTo    || r.date <= dateTo;
        return matchStore && matchFrom && matchTo;
      })
    );
  }, [records, storeFilter, dateFrom, dateTo]);

  // Summary per store from filtered set
  function summary() {
    const out = {};
    STORES.forEach((s) => { out[s] = { cash: 0, card: 0, total: 0 }; });
    filtered.forEach((r) => {
      if (out[r.store]) {
        out[r.store].cash  += r.totalCash  || 0;
        out[r.store].card  += r.totalCard  || 0;
        out[r.store].total += r.totalSales || 0;
      }
    });
    return out;
  }

  function exportCSV() {
    const cols = ['Date', 'Store', 'Staff', 'Cash (£)', 'Card (£)', 'Total (£)', 'Notes'];
    const rows = filtered.map((r) =>
      [r.date, r.store, r.submittedByName, r.totalCash?.toFixed(2), r.totalCard?.toFixed(2),
       r.totalSales?.toFixed(2), r.notes || '']
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv  = [cols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `cashouts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function fmt(n) { return `£${Number(n || 0).toFixed(2)}`; }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
  }

  const sum = summary();

  return (
    <div className="layout">
      <Toast {...toast} onClose={clearToast} />
      <Sidebar activePath="/admin/cashout" />

      <main className="main-content">
        <div className="page-header">
          <h2>Cash Out Records</h2>
          <p className="page-subtitle">End-of-day submissions from all stores</p>
        </div>

        {/* Summary cards per store */}
        <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${STORES.length * 3}, 1fr)` }}>
          {STORES.map((store) => (
            <React.Fragment key={store}>
              <div className="stat-card">
                <div className="stat-card__value" style={{ fontSize: '1.3rem' }}>{fmt(sum[store]?.cash)}</div>
                <div className="stat-card__label">{store} — Cash</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__value" style={{ fontSize: '1.3rem' }}>{fmt(sum[store]?.card)}</div>
                <div className="stat-card__label">{store} — Card</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__value" style={{ fontSize: '1.3rem' }}>{fmt(sum[store]?.total)}</div>
                <div className="stat-card__label">{store} — Total</div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Filters */}
        <div className="filter-bar">
          <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
            <option value="">All Stores</option>
            {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            title="From date" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            title="To date" />
          <button className="btn btn--ghost btn--sm" onClick={exportCSV}>
            ⬇ Export CSV
          </button>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading cash out records…" />
        ) : filtered.length === 0 ? (
          <div className="empty-state">No records match your filters.</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Store</th>
                  <th>Staff</th>
                  <th>Cash (£)</th>
                  <th>Card (£)</th>
                  <th>Total (£)</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    <td>
                      <span className={`badge badge--${r.store === 'Chase Side' ? 'info' : 'success'}`}>
                        {r.store}
                      </span>
                    </td>
                    <td>{r.submittedByName || '—'}</td>
                    <td>{fmt(r.totalCash)}</td>
                    <td>{fmt(r.totalCard)}</td>
                    <td><strong>{fmt(r.totalSales)}</strong></td>
                    <td style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, background: 'var(--gray-50)' }}>
                  <td colSpan={3}>Totals ({filtered.length} records)</td>
                  <td>{fmt(filtered.reduce((s, r) => s + (r.totalCash  || 0), 0))}</td>
                  <td>{fmt(filtered.reduce((s, r) => s + (r.totalCard  || 0), 0))}</td>
                  <td>{fmt(filtered.reduce((s, r) => s + (r.totalSales || 0), 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
