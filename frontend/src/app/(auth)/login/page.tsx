import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="brand" style={{ marginBottom: 18 }}>
          <div className="brand-mark">AX</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.35rem' }}>AI Excel</div>
            <div className="muted">Google and Microsoft OAuth are wired to the backend now. If provider keys are missing, the backend falls back to local demo mode for development.</div>
          </div>
        </div>

        <h1 className="page-title" style={{ fontSize: '2.5rem' }}>
          Work with spreadsheets like a power user, not a prisoner of tabs.
        </h1>
        <p className="page-subtitle">
          Sign in with Google or Microsoft to start working with spreadsheet tasks, reports, charts, and guided analysis.
        </p>

        <div className="grid" style={{ marginTop: 20 }}>
          <Link href="/api/auth/google" className="button button-primary">
            Continue with Google
          </Link>
          <Link href="/api/auth/microsoft" className="button button-secondary">
            Continue with Microsoft
          </Link>
          <Link href="/dashboard" className="button button-ghost">
            Enter dashboard shell
          </Link>
        </div>

        <div className="empty-state" style={{ marginTop: 20 }}>
          Development note: if OAuth credentials are not configured yet, the backend keeps a safe demo fallback so the rest of the product flow still works.
        </div>
      </div>
    </div>
  );
}
