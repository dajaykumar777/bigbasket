import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { hashPin } from '../utils/hashPin';
import { useAuth } from '../contexts/AuthContext';
import { logAction } from '../utils/auditLogger';
import Toast, { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';

export default function UserLogin() {
  const navigate = useNavigate();
  const { toast, showToast, clearToast } = useToast();
  const { setAuthLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [pin, setPin]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPin, setShowPin]   = useState(false);

  async function handleLogin(e) {
    e.preventDefault();

    if (!username.trim() || !pin.trim()) {
      showToast('Username and PIN are required.', 'error');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      showToast('PIN must be exactly 4 digits.', 'error');
      return;
    }

    setLoading(true);
    try {
      const cleanUsername = username.trim().toLowerCase();
      // Hash the PIN client-side before using it as the Firebase Auth password.
      const pinHash = await hashPin(pin, cleanUsername);
      // Synthetic email keeps users in a separate namespace from admins.
      const email = `${cleanUsername}@shopapp.internal`;

      // Signal AuthContext to stay in loading state so ProtectedRoute shows a
      // spinner instead of redirecting before the Firestore check completes.
      setAuthLoading(true);
      const credential = await signInWithEmailAndPassword(auth, email, pinHash);

      // Check Firestore status before proceeding — Firebase Auth succeeds even
      // for disabled app accounts since we manage status ourselves.
      const userSnap = await getDoc(doc(db, 'users', credential.user.uid));
      const status   = userSnap.data()?.status;
      const fullName = userSnap.data()?.fullName || cleanUsername;
      const shopName = userSnap.data()?.shopName || '';
      if (!userSnap.exists() || status !== 'active') {
        await signOut(auth);
        setAuthLoading(false);
        const reason = status === 'inactive' ? 'account_disabled' : 'account_not_found';
        await logAction({
          action: 'USER_LOGIN_FAILED',
          performedBy: credential.user.uid,
          performedByName: fullName,
          details: { username: cleanUsername, fullName, reason },
        });
        showToast(
          status === 'inactive'
            ? 'Your account has been disabled. Please contact your administrator.'
            : 'Account not found. Please contact your administrator.',
          'error'
        );
        setLoading(false);
        return;
      }

      await logAction({
        action: 'USER_LOGIN',
        performedBy: credential.user.uid,
        performedByName: fullName,
        details: { username: cleanUsername, fullName, shopName },
      });
      navigate('/invoices/upload', { replace: true });
    } catch (err) {
      // Firebase returns various error codes for wrong credentials.
      const isCredError = [
        'auth/user-not-found',
        'auth/wrong-password',
        'auth/invalid-credential',
        'auth/invalid-login-credentials',
      ].includes(err.code);

      // Log failure — performedBy is '' because auth failed
      await logAction({
        action: 'USER_LOGIN_FAILED',
        performedBy: '',
        performedByName: cleanUsername,
        details: { username: cleanUsername, reason: err.code || 'unknown' },
      });
      setAuthLoading(false); // reset global loading on Firebase auth error
      showToast(
        isCredError ? 'Invalid username or PIN.' : (err.message || 'Login failed.'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <Toast {...toast} onClose={clearToast} />

      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="back-link">← Back</Link>
          <h2>Big Basket Shop Staff Sign In</h2>
          <p>Enter your username and PIN to access your invoices.</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              required
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="pin">PIN</label>
            <div className="input-with-toggle">
              <input
                id="pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4 digit PIN"
                required
                maxLength={4}
              />
              <button
                type="button"
                className="toggle-btn"
                onClick={() => setShowPin((s) => !s)}
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
            {loading ? <LoadingSpinner message="Signing in…" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
