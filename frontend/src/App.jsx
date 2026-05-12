import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

// Pages
import RoleSelection    from './pages/RoleSelection';
import AdminLogin       from './pages/AdminLogin';
import UserLogin        from './pages/UserLogin';
import AdminDashboard   from './pages/AdminDashboard';
import UserManagement   from './pages/UserManagement';
import AuditLogs        from './pages/AuditLogs';
import InvoiceUpload    from './pages/InvoiceUpload';
import InvoiceList      from './pages/InvoiceList';
import CashOut          from './pages/CashOut';
import AdminCashOut     from './pages/AdminCashOut';

export default function App() {
  const { loading, currentUser, role } = useAuth();

  if (loading) return <LoadingSpinner fullScreen message="Starting up…" />;

  return (
    <Routes>
      {/* Public */}
      <Route path="/"             element={<RoleSelection />} />
      <Route path="/admin/login"  element={<AdminLogin />} />
      <Route path="/user/login"   element={<UserLogin />} />

      {/* Admin-only routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requiredRole="admin" redirectTo="/admin/login">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute requiredRole="admin" redirectTo="/admin/login">
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute requiredRole="admin" redirectTo="/admin/login">
            <AuditLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/cashout"
        element={
          <ProtectedRoute requiredRole="admin" redirectTo="/admin/login">
            <AdminCashOut />
          </ProtectedRoute>
        }
      />

      {/* User routes */}
      <Route
        path="/invoices/upload"
        element={
          <ProtectedRoute requiredRole="user" redirectTo="/user/login">
            <InvoiceUpload />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cashout"
        element={
          <ProtectedRoute requiredRole="user" redirectTo="/user/login">
            <CashOut />
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices"
        element={
          <ProtectedRoute redirectTo="/">
            <InvoiceList />
          </ProtectedRoute>
        }
      />

      {/* Catch-all: redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
