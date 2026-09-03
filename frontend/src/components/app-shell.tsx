'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PropsWithChildren } from 'react';

const primaryNav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pivot-builder', label: 'Pivot Builder' },
  { href: '/assistant', label: 'Spreadsheet Assistant' },
  { href: '/data-analysis', label: 'Data Analysis' },
  { href: '/charts', label: 'Charts & Graphs' },
  { href: '/reports', label: 'Reports' },
];

const secondaryNav = [
  { href: '/billing', label: 'Billing' },
  { href: '/usage', label: 'Usage History' },
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AX</div>
          <div>
            <div style={{ fontWeight: 800 }}>AI Excel</div>
            <div className="muted" style={{ fontSize: '0.92rem' }}>
              spreadsheet co-pilot
            </div>
          </div>
        </div>

        <nav className="nav-group">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              data-active={pathname === item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div
          style={{
            height: 1,
            background: 'rgba(31, 45, 64, 0.08)',
            margin: '18px 0',
          }}
        />

        <nav className="nav-group">
          {secondaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              data-active={pathname === item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Free plan guide rail</div>
          <div className="muted" style={{ fontSize: '0.92rem', marginBottom: 14 }}>
            Ship the MVP flow first, then swap the mock login for real Google and Microsoft OAuth.
          </div>
          <Link href="/billing" className="button button-primary" style={{ display: 'inline-flex' }}>
            Upgrade to Pro
          </Link>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
