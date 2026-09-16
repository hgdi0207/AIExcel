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
          <div className="brand-copy">
            <span className="brand-title">AI Excel</span>
            <span className="brand-tagline">spreadsheet co-pilot</span>
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

        <div className="sidebar-divider" />

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
          <div className="sidebar-footer-title">Free plan guide rail</div>
          <div className="sidebar-footer-copy">
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
