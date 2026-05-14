import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { hashPin } from '../utils/hashPin';
import { useAuth } from '../contexts/AuthContext';
import { logAction } from '../utils/auditLogger';
import Toast, { useToast } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';

const ADMIN_DOMAIN = '@shopapp.internal';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { toast, showToast, clearToast } = useToast();
  const { setAuthLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [pin, setPin]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPin, setShowPin]   = useState(false);

  async function handleSignIn(e) {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) return;
    if (!/^\d{4}$/.test(pin)) {
      showToast('PIN must be exactly 4 digits.', 'error');
      return;
    }

    setLoading(true);
    try {
      const cleanUsername = username.trim().toLowerCase();
      const pinHash = await hashPin(pin, cleanUsername);
      const email = `${cleanUsername}${ADMIN_DOMAIN}`;

      setAuthLoading(true);
      const credential = await signInWithEmailAndPassword(auth, email, pinHash);
      await logAction({
        action: 'ADMIN_LOGIN',
        performedBy: credential.user.uid,
        performedByName: cleanUsername,
        details: { username: cleanUsername },
      });
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      const isCredError = [
        'auth/user-not-found',
        'auth/wrong-password',
        'auth/invalid-credential',
        'auth/invalid-login-credentials',
      ].includes(err.code);

      await logAction({
        action: 'USER_LOGIN_FAILED',
        performedBy: '',
        performedByName: username.trim().toLowerCase(),
        details: { username: username.trim().toLowerCase(), role: 'admin', reason: err.code || 'unknown' },
      });
      setAuthLoading(false);
      showToast(
        isCredError ? 'Invalid username or PIN.' : (err.message || 'Sign in failed.'),
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
          <h2>Big Basket Shop Staff Admin Sign In</h2>
          <p>Enter your admin username and PIN.</p>
        </div>

        <form onSubmit={handleSignIn} className="auth-form">
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
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-digit PIN"
                maxLength={4}
                required
              />
              <button
                type="button"
                className="toggle-btn"
                onClick={() => setShowPin((v) => !v)}
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
