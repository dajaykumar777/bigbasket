import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, addDoc, query, where, orderBy, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { logAction } from '../utils/auditLogger';
import Toast, { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar from '../components/Sidebar';

const STORES = ['Chase Side', 'Ley Street'];

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  store: '', date: today(), totalCash: '', totalCard: '', notes: '',
};

export default function CashOut() {
  const navigate = useNavigate();
  const { currentUser, userData, userClaims, logout } = useAuth();
  const { toast, showToast, clearToast } = useToast();

  const submittedByName = userData?.fullName || userClaims?.username || currentUser?.email || '';

  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState({});
  const [recent, setRecent]     = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Derived: total sales
  const totalSales = (parseFloat(form.totalCash) || 0) + (parseFloat(form.totalCard) || 0);

  useEffect(() => {
    loadRecent();
  }, []);

  async function loadRecent() {
    setLoadingRecent(true);
    try {
      // Only filter by submittedBy (no composite index needed) — sort client-side.
      const snap = await getDocs(
        query(
          collection(db, 'cashOuts'),
          where('submittedBy', '==', currentUser.uid)
        )
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toDate?.() ?? new Date(a.date);
          const tb = b.createdAt?.toDate?.() ?? new Date(b.date);
          return tb - ta;
        })
        .slice(0, 10);
      setRecent(list);
    } catch (err) {
      console.error('Failed to load recent cash outs:', err);
    } finally {
      setLoadingRecent(false);
    }
  }

  function handleField(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((errs) => ({ ...errs, [name]: undefined }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.store)  errs.store = 'Store is required.';
    if (!form.date)   errs.date  = 'Date is required.';
    if (form.totalCash === '' || isNaN(Number(form.totalCash)) || Number(form.totalCash) < 0)
      errs.totalCash = 'Enter a valid cash amount (0 or more).';
    if (form.totalCard === '' || isNaN(Number(form.totalCard)) || Number(form.totalCard) < 0)
      errs.totalCard = 'Enter a valid card amount (0 or more).';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const cash  = parseFloat(form.totalCash);
      const card  = parseFloat(form.totalCard);
      const total = cash + card;

      const docRef = await addDoc(collection(db, 'cashOuts'), {
        store:           form.store,
        date:            form.date,
        totalCash:       cash,
        totalCard:       card,
        totalSales:      total,
        notes:           form.notes.trim(),
        submittedBy:     currentUser.uid,
        submittedByName,
        createdAt:       serverTimestamp(),
      });

      await logAction({
        action:          'CASHOUT_SUBMITTED',
        performedBy:     currentUser.uid,
        performedByName: submittedByName,
        targetId:        docRef.id,
        details: { store: form.store, date: form.date, totalCash: cash, totalCard: card, totalSales: total },
      });

      showToast('Cash out submitted!', 'success');
      setForm({ ...EMPTY, date: today() });
      setErrors({});
      loadRecent();
    } catch (err) {
      showToast(err.message || 'Failed to submit.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function fmt(n) { return `£${Number(n || 0).toFixed(2)}`; }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
  }

  return (
    <div className="layout">
      <Toast {...toast} onClose={clearToast} />
      <Sidebar activePath="/cashout" />

      <main className="main-content">
        <div className="page-header">
          <h2>End of Day Cash Out</h2>
          <p className="page-subtitle">Submit your daily cash and card totals</p>
        </div>

        <div className="card" style={{ maxWidth: 820 }}>
          <form onSubmit={handleSubmit} className="invoice-form">

            <div className="form-row">
              <div className="form-group">
                <label>Store *</label>
                <select name="store" value={form.store} onChange={handleField}>
                  <option value="">— Select store —</option>
                  {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.store && <span className="field-error">{errors.store}</span>}
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input type="date" name="date" value={form.date} onChange={handleField} />
                {errors.date && <span className="field-error">{errors.date}</span>}
              </div>
            </div>

            <div className="form-row form-row--3">
              <div className="form-group">
                <label>Total Cash (£) *</label>
                <input type="number" name="totalCash" step="0.01" min="0"
                  value={form.totalCash} onChange={handleField} placeholder="0.00" />
                {errors.totalCash && <span className="field-error">{errors.totalCash}</span>}
              </div>
              <div className="form-group">
                <label>Total Card (£) *</label>
                <input type="number" name="totalCard" step="0.01" min="0"
                  value={form.totalCard} onChange={handleField} placeholder="0.00" />
                {errors.totalCard && <span className="field-error">{errors.totalCard}</span>}
              </div>
              <div className="form-group">
                <label>Total Sales (£)</label>
                <input type="text" value={`£${totalSales.toFixed(2)}`} readOnly
                  className="input--readonly" />
              </div>
            </div>

            <div className="form-group">
              <label>Notes <span className="label-optional">(optional)</span></label>
              <textarea name="notes" value={form.notes} onChange={handleField}
                rows={3} placeholder="Any discrepancies or comments…"
                style={{ width: '100%', resize: 'vertical', padding: '8px', borderRadius: '6px', border: '1px solid var(--gray-200)', fontSize: '0.9rem' }}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? <LoadingSpinner message="Submitting…" /> : 'Submit Cash Out'}
              </button>
            </div>
          </form>
        </div>

        {/* Recent submissions */}
        <section className="card" style={{ marginTop: 24 }}>
          <h3 className="card__title">My Recent Submissions</h3>
          {loadingRecent ? (
            <LoadingSpinner message="Loading…" />
          ) : recent.length === 0 ? (
            <p className="empty-state">No submissions yet.</p>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Store</th>
                    <th>Cash (£)</th>
                    <th>Card (£)</th>
                    <th>Total (£)</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.date)}</td>
                      <td>{r.store}</td>
                      <td>{fmt(r.totalCash)}</td>
                      <td>{fmt(r.totalCard)}</td>
                      <td><strong>{fmt(r.totalSales)}</strong></td>
                      <td style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
