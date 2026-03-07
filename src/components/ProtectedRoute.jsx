import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute - renders children only when the user is authenticated.
 * While loading the initial session, shows nothing (avoids a flash of the login page).
 * Unauthenticated users are redirected to /login.
 */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    // Minimal loading state – keeps the background consistent
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-background-base)',
        color: 'var(--color-text-muted)',
        fontSize: '0.9rem',
        letterSpacing: '0.1em',
      }}>
        AUTHENTICATING...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
