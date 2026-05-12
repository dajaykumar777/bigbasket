import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * Wraps a route that requires authentication and a specific role.
 *
 * @param {string}  requiredRole  - 'admin' | 'user' | undefined (any auth)
 * @param {string}  redirectTo    - where to redirect if check fails
 */
export default function ProtectedRoute({ children, requiredRole, redirectTo = '/' }) {
  const { currentUser, role, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Verifying session…" />;
  }

  if (!currentUser) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requiredRole && role !== requiredRole) {
    // Logged in but wrong role → send to the right home
    const home = role === 'admin' ? '/admin/dashboard' : '/invoices/upload';
    return <Navigate to={home} replace />;
  }

  return children;
}
