'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

export function AuthStatus() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void getCurrentUser()
      .then((payload) => {
        setUser(payload.user);
      })
      .catch((err: Error) => {
        setError(err.message);
      });
  }, []);

  if (user) {
    return <div className="badge">{user.name} · {user.plan}</div>;
  }

  if (error) {
    return <div className="badge">Not signed in</div>;
  }

  return <div className="badge">Checking session…</div>;
}
