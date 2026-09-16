'use client';

import { PropsWithChildren, useEffect, useState } from 'react';
import { ApiError, getCurrentUser, redirectToLogin } from '@/lib/api';

export function AuthGuard({ children }: PropsWithChildren) {
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then(() => {
        if (active) setAuthenticated(true);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          redirectToLogin();
          return;
        }
        setError(reason instanceof Error ? reason.message : 'Unable to verify your session');
      });

    return () => {
      active = false;
    };
  }, []);

  if (authenticated) return children;
  return (
    <div className="login-shell">
      <div className="login-card" role="status" aria-live="polite">
        <h1 className="page-title" style={{ fontSize: '1.75rem' }}>
          {error ? 'Session check failed' : 'Checking your session'}
        </h1>
        <p className="page-subtitle">
          {error || 'Please wait while we verify your sign-in.'}
        </p>
      </div>
    </div>
  );
}
