import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  collection, getDocs, query, orderBy,
  doc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase/config';
import { hashPin } from '../utils/hashPin';
import { useAuth } from '../contexts/AuthContext';
import Toast, { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { logAction } from '../utils/auditLogger';
import Sidebar from '../components/Sidebar';

const EMPTY_FORM = {
  fullName: '', username: '', pin: '', confirmPin: '',
  shopName: '', phone: '', status: 'active',
};

export default function UserManagement() {
  const navigate = useNavigate();
  const { logout, currentUser, userData } = useAuth();
  const { toast, showToast, clearToast } = useToast();
  const adminName = userData?.fullName || userData?.username || '';

  const [users, setUsers]           = useState([]);
  const [filtered, setFiltered]     = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  const [showModal, setShowModal]   = useState(false);
  const [editUser, setEditUser]     = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  // ── Fetch users ──────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      // Exclude soft-deleted users
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.status !== 'deleted');
      setUsers(list);
      setFiltered(list);
    } catch {
      showToast('Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Search ───────────────────────────────────────────────
  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? users.filter(
            (u) =>
              u.username?.includes(q) ||
              u.fullName?.toLowerCase().includes(q) ||
              u.shopName?.toLowerCase().includes(q) ||
              u.phone?.includes(q)
          )
        : users
    );
  }, [search, users]);

  // ── Modal helpers ────────────────────────────────────────
  function openCreateModal() {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowModal(true);
  }

  function openEditModal(user) {
    setEditUser(user);
    // Strip the +44 prefix to get just the 10-digit local part for editing
    const stored = user.phone || '';
    const phone = stored.startsWith('+44') ? stored.slice(3) : stored;
    setForm({
      fullName: user.fullName || '',
      username: user.username || '',
      pin: '', confirmPin: '',
      shopName: user.shopName || '',
      phone,
      status: user.status || 'active',
    });
    setFormErrors({});
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditUser(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  function handleField(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function validateForm() {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!form.shopName.trim()) errs.shopName = 'Shop name is required.';
    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required.';
    } else if (!/^7\d{9}$/.test(form.phone.trim())) {
      errs.phone = 'Enter a valid UK mobile: 10 digits starting with 7 (e.g. 7700900000).';
    }
    if (!editUser) {
      if (!form.username.trim()) errs.username = 'Username is required.';
      if (!/^[a-z0-9_]{3,20}$/.test(form.username.trim().toLowerCase()))
        errs.username = 'Username: 3-20 chars, letters/numbers/underscore only.';
      if (!form.pin) errs.pin = 'PIN is required.';
      if (!/^\d{4}$/.test(form.pin)) errs.pin = 'PIN must be exactly 4 digits.';
      if (form.pin !== form.confirmPin) errs.confirmPin = 'PINs do not match.';
    }
    return errs;
  }

  // ── Create user ──────────────────────────────────────────
  // Uses a secondary Firebase app instance so the admin stays signed in.
  async function createUser() {
    const cleanUsername = form.username.trim().toLowerCase();
    const pinHash       = await hashPin(form.pin, cleanUsername);
    const internalEmail = `${cleanUsername}@shopapp.internal`;

    // Check username uniqueness in Firestore
    const existing = users.find((u) => u.username === cleanUsername);
    if (existing) {
      return { error: `Username "${cleanUsername}" is already taken.` };
    }

    // Create a temporary secondary Firebase app so we don't sign out the admin.
    const secondaryApp  = initializeApp(firebaseConfig, `create-user-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, internalEmail, pinHash);
      const uid  = cred.user.uid;

      await setDoc(doc(db, 'users', uid), {
        fullName:  form.fullName.trim(),
        username:  cleanUsername,
        shopName:  form.shopName.trim(),
        phone:     '+44' + form.phone.trim(),
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      await logAction({
        action:          'USER_CREATED',
        performedBy:     currentUser.uid,
        performedByName: adminName,
        targetId:        uid,
        details:         { username: cleanUsername, shopName: form.shopName },
      });

      return { success: true };
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        return { error: `Username "${cleanUsername}" is already taken.` };
      }
      return { error: err.message || 'Failed to create user.' };
    } finally {
      await deleteApp(secondaryApp);
    }
  }

  // ── Update user ──────────────────────────────────────────
  async function updateUser() {
    const userRef = doc(db, 'users', editUser.id);
    await updateDoc(userRef, {
      fullName:  form.fullName.trim(),
      shopName:  form.shopName.trim(),
      phone:     '+44' + form.phone.trim(),
      status:    form.status,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
    });

    await logAction({
      action:          form.status === 'inactive' ? 'USER_DISABLED' : 'USER_UPDATED',
      performedBy:     currentUser.uid,
      performedByName: adminName,
      targetId:        editUser.id,
      details:         { username: editUser.username },
    });

    return { success: true };
  }

  // ── Submit (create or update) ────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    setSaving(true);
    try {
      const result = editUser ? await updateUser() : await createUser();
      if (result.error) {
        showToast(result.error, 'error');
      } else {
        showToast(editUser ? 'User updated.' : 'User created.', 'success');
        closeModal();
        fetchUsers();
      }
    } catch (err) {
      showToast(err.message || 'Operation failed.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle active / inactive ─────────────────────────────
  async function handleToggleStatus(user) {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    if (!window.confirm(`${newStatus === 'inactive' ? 'Deactivate' : 'Activate'} "${user.fullName}"?`)) return;

    try {
      await updateDoc(doc(db, 'users', user.id), {
        status:    newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
      await logAction({
        action:          newStatus === 'inactive' ? 'USER_DISABLED' : 'USER_UPDATED',
        performedBy:     currentUser.uid,
        performedByName: adminName,
        targetId:        user.id,
        details:         { username: user.username, newStatus },
      });
      showToast(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}.`, 'success');
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Status update failed.', 'error');
    }
  }

  // ── Soft delete ──────────────────────────────────────────
  // We mark the user as 'deleted' in Firestore. Their Firebase Auth account
  // remains but they can no longer log in (AuthContext rejects inactive/deleted).
  async function handleDelete(user) {
    if (!window.confirm(
      `Disable "${user.fullName}" permanently?\n\n` +
      `Their data will be kept but they will not be able to log in again. ` +
      `Their username cannot be reused.`
    )) return;

    try {
      await updateDoc(doc(db, 'users', user.id), {
        status:    'deleted',
        deletedAt: serverTimestamp(),
        deletedBy: currentUser.uid,
      });
      await logAction({
        action:          'USER_DELETED',
        performedBy:     currentUser.uid,
        performedByName: adminName,
        targetId:        user.id,
        details:         { username: user.username, fullName: user.fullName },
      });
      showToast('User removed.', 'success');
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Delete failed.', 'error');
    }
  }

  return (
    <div className="layout">
      <Toast {...toast} onClose={clearToast} />
      <Sidebar activePath="/admin/users" />

      <main className="main-content">
        <div className="page-header">
          <div>
            <h2>User Management</h2>
            <p className="page-subtitle">{users.length} user(s)</p>
          </div>
          <button className="btn btn--primary" onClick={openCreateModal}>+ New User</button>
        </div>

        <div className="search-bar">
          <input
            type="search"
            placeholder="Search by name, username, shop or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <LoadingSpinner message="Loading users…" />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {search ? 'No users match your search.' : 'No users yet. Create one!'}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Shop</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td>{user.fullName}</td>
                    <td><code>{user.username}</code></td>
                    <td>{user.shopName}</td>
                    <td>{user.phone}</td>
                    <td>
                      <span className={`badge badge--${user.status === 'active' ? 'success' : 'warning'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="btn btn--sm btn--secondary" onClick={() => openEditModal(user)}>
                          Edit
                        </button>
                        <button
                          className={`btn btn--sm ${user.status === 'active' ? 'btn--warning' : 'btn--success'}`}
                          onClick={() => handleToggleStatus(user)}
                        >
                          {user.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn btn--sm btn--danger" onClick={() => handleDelete(user)}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="info-note">
          <strong>Note:</strong> PIN reset is not available on the free plan.
          To change a user's PIN, remove them and create a new account with the same details.
        </div>
      </main>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3>{editUser ? 'Edit User' : 'Create New User'}</h3>
              <button className="modal__close" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="modal__body">
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input name="fullName" value={form.fullName} onChange={handleField} placeholder="John Doe" />
                  {formErrors.fullName && <span className="field-error">{formErrors.fullName}</span>}
                </div>
                <div className="form-group">
                  <label>Shop Name *</label>
                  <input name="shopName" value={form.shopName} onChange={handleField} placeholder="My Shop" />
                  {formErrors.shopName && <span className="field-error">{formErrors.shopName}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Username{!editUser && ' *'}</label>
                  <input
                    name="username"
                    value={form.username}
                    onChange={handleField}
                    placeholder="john_doe"
                    disabled={!!editUser}
                    autoCapitalize="none"
                  />
                  {formErrors.username && <span className="field-error">{formErrors.username}</span>}
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <div className="phone-input-row">
                    <span className="phone-prefix">+44</span>
                    <input
                      name="phone"
                      value={form.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        handleField({ target: { name: 'phone', value: val } });
                      }}
                      placeholder="7700900000"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </div>
                  {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                </div>
              </div>

              {!editUser && (
                <div className="form-row">
                  <div className="form-group">
                    <label>PIN (4 digits) *</label>
                    <input
                      name="pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={form.pin}
                      onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
                      placeholder="••••"
                    />
                    {formErrors.pin && <span className="field-error">{formErrors.pin}</span>}
                  </div>
                  <div className="form-group">
                    <label>Confirm PIN *</label>
                    <input
                      name="confirmPin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={form.confirmPin}
                      onChange={(e) => setForm((f) => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '') }))}
                      placeholder="••••"
                    />
                    {formErrors.confirmPin && <span className="field-error">{formErrors.confirmPin}</span>}
                  </div>
                </div>
              )}

              {editUser && (
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={form.status} onChange={handleField}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}

              <div className="modal__footer">
                <button type="button" className="btn btn--ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? <LoadingSpinner message="Saving…" /> : editUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
