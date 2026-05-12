import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, query, where, orderBy, getDocs, limit,
  startAfter, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import Toast, { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar from '../components/Sidebar';

const PAGE_SIZE = 15;

export default function InvoiceList() {
  const navigate  = useNavigate();
  const { currentUser, isAdmin, userClaims, logout } = useAuth();
  const { toast, showToast, clearToast } = useToast();

  const [invoices, setInvoices]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [lastDoc, setLastDoc]     = useState(null);
  const [hasMore, setHasMore]     = useState(false);
  const [search, setSearch]       = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [filtered, setFiltered]   = useState([]);
  const [lightbox, setLightbox]   = useState(null); // base64 src

  const buildQuery = useCallback((after = null) => {
    const col = collection(db, 'invoices');
    if (isAdmin) {
      // Admin: no createdBy filter — orderBy alone uses a single-field auto-index ✓
      const constraints = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE)];
      if (after) constraints.push(startAfter(after));
      return query(col, ...constraints);
    } else {
      // User: filter by createdBy only — no orderBy, so no composite index needed.
      // Results are sorted client-side after fetch.
      const constraints = [where('createdBy', '==', currentUser.uid), limit(PAGE_SIZE)];
      if (after) constraints.push(startAfter(after));
      return query(col, ...constraints);
    }
  }, [isAdmin, currentUser]);

  const fetchInvoices = useCallback(async (append = false) => {
    setLoading(true);
    try {
      const snap = await getDocs(buildQuery(append ? lastDoc : null));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          // Sort newest first client-side for user queries
          const ta = a.createdAt?.toDate?.() ?? new Date(0);
          const tb = b.createdAt?.toDate?.() ?? new Date(0);
          return tb - ta;
        });
      setInvoices((prev) => append ? [...prev, ...list] : list);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      showToast(`Failed to load invoices: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [buildQuery, lastDoc]);

  useEffect(() => { fetchInvoices(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      invoices.filter((inv) => {
        const matchSearch = !q ||
          inv.invoiceNumber?.toLowerCase().includes(q) ||
          inv.vendorName?.toLowerCase().includes(q) ||
          inv.shopName?.toLowerCase().includes(q);
        const matchStore = !storeFilter || inv.store === storeFilter;
        return matchSearch && matchStore;
      })
    );
  }, [search, storeFilter, invoices]);

  async function handleDelete(invoice) {
    if (!window.confirm(`Delete invoice "${invoice.invoiceNumber}"?`)) return;
    try {
      await deleteDoc(doc(db, 'invoices', invoice.id));
      setInvoices((prev) => prev.filter((i) => i.id !== invoice.id));
      showToast('Invoice deleted.', 'success');
    } catch {
      showToast('Delete failed.', 'error');
    }
  }

  function exportCSV() {
    const cols = isAdmin
      ? ['Invoice #', 'Vendor', 'Shop', 'Staff', 'Store', 'Date', 'Uploaded', 'Goods (£)', 'VAT (£)', 'Total (£)', 'Status', 'Payment']
      : ['Invoice #', 'Vendor', 'Store', 'Date', 'Uploaded', 'Goods (£)', 'VAT (£)', 'Total (£)', 'Status', 'Payment'];
    const rows = filtered.map((inv) => {
      const base = [
        inv.invoiceNumber || '',
        inv.vendorName || '',
        ...(isAdmin ? [inv.shopName || '', inv.paidBy || ''] : []),
        inv.store || '',
        inv.invoiceDate || '',
        formatDateTime(inv.createdAt),
        (inv.amount || 0).toFixed(2),
        (inv.tax || 0).toFixed(2),
        (inv.total || 0).toFixed(2),
        inv.paymentStatus || '',
        inv.paymentMethod || '',
      ];
      return base.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `invoices_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    // invoiceDate is stored as "YYYY-MM-DD" string
    if (typeof dateStr === 'string') {
      const [y, m, d] = dateStr.split('-');
      if (y && m && d) return `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m,10)-1]} ${y}`;
      return dateStr;
    }
    const d = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function formatAmount(inv) {
    return `£${Number(inv.total || 0).toFixed(2)}`;
  }

  return (
    <div className="layout">
      <Toast {...toast} onClose={clearToast} />
      <Sidebar activePath="/invoices" />

      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>{isAdmin ? 'All Invoices' : 'My Invoices'}</h2>
            <p className="page-subtitle">{filtered.length} invoice(s)</p>
          </div>
          {!isAdmin && (
            <Link to="/invoices/upload" className="btn btn--primary">+ New Invoice</Link>
          )}
        </div>

        <div className="filter-bar">
          <input
            type="search"
            placeholder="Search by invoice #, vendor, or shop…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
            <option value="">All Stores</option>
            <option value="Chase Side">Chase Side</option>
            <option value="Ley Street">Ley Street</option>
          </select>
          {isAdmin && (
            <button className="btn btn--ghost btn--sm" onClick={exportCSV}>
              ⬇ Export CSV
            </button>
          )}
        </div>

        {loading && invoices.length === 0 ? (
          <LoadingSpinner message="Loading invoices…" />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {search ? 'No invoices match your search.' : 'No invoices yet.'}
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Invoice Number</th>
                    <th>Vendor</th>
                    {isAdmin && <th>Shop</th>}
                    {isAdmin && <th>Staff</th>}
                    <th>Store</th>
                    <th>Invoice Date</th>
                    <th>Uploaded</th>
                    <th>Goods (£)</th>
                    <th>VAT (£)</th>
                    <th>Total (£)</th>
                    <th>Status</th>
                    <th>Payment</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ width: '52px', textAlign: 'center' }}>
                        {inv.thumbnailBase64 ? (
                          <img
                            src={inv.thumbnailBase64}
                            alt="receipt"
                            className="invoice-thumb"
                            onClick={() => setLightbox(inv.previewBase64 || inv.thumbnailBase64)}
                          />
                        ) : '—'}
                      </td>
                      <td><strong>{inv.invoiceNumber || '—'}</strong></td>
                      <td>{inv.vendorName}</td>
                      {isAdmin && <td>{inv.shopName || '—'}</td>}
                      {isAdmin && <td>{inv.paidBy || '—'}</td>}
                      <td>{inv.store || '—'}</td>
                      <td>{inv.invoiceDate ? formatDate(inv.invoiceDate) : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--gray-400)', fontSize: '0.82rem' }}>{formatDateTime(inv.createdAt)}</td>
                      <td>£{Number(inv.amount || 0).toFixed(2)}</td>
                      <td>£{Number(inv.tax || 0).toFixed(2)}</td>
                      <td><strong>{formatAmount(inv)}</strong></td>
                      <td>
                        <span className={`badge badge--${inv.paymentStatus === 'Paid' ? 'success' : 'warning'}`}>
                          {inv.paymentStatus || '—'}
                        </span>
                      </td>
                      <td>{inv.paymentMethod || '—'}</td>
                      {isAdmin && (
                        <td>
                          <button
                            className="btn btn--sm btn--danger"
                            onClick={() => handleDelete(inv)}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="load-more">
                <button
                  className="btn btn--ghost"
                  onClick={() => fetchInvoices(true)}
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner message="Loading…" /> : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Lightbox */}
        {lightbox && (
          <div className="lightbox-backdrop" onClick={() => setLightbox(null)}>
            <div className="lightbox-box" onClick={(e) => e.stopPropagation()}>
              <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
              <img src={lightbox} alt="Invoice receipt" className="lightbox-img" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
