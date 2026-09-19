'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { getUsageSummary } from '@/lib/api';
import type { UsageSummary } from '@/lib/types';

const nav = [
  ['/dashboard', 'DB', 'Dashboard'],
  ['/assistant', 'AI', 'AI Chat'],
  ['/formulas', 'FX', 'Formulas'],
  ['/scripts', '</>', 'Scripts'],
  ['/pivot-builder', 'PT', 'Pivot Tables'],
  ['/data-analysis', 'DA', 'Data Analysis'],
  ['/charts', 'CH', 'Charts'],
  ['/reports', 'RP', 'Reports'],
] as const;

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => { void getUsageSummary().then(setUsage).catch(() => undefined); }, [pathname]);

  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col md:flex-row">
        <aside className="w-full md:w-[220px] md:min-w-[220px] bg-white border-r border-border-gray flex flex-col md:sticky top-0 md:h-screen z-20">
          <div className="p-4 border-b border-border-gray">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-green rounded-md flex items-center justify-center text-white font-bold text-sm">GX</div>
              <span className="text-lg font-semibold text-text-primary">GPTEXCEL</span>
            </Link>
          </div>
          <nav className="flex-1 p-4 overflow-y-auto grid grid-cols-2 md:block gap-1">
            {nav.map(([href, icon, label]) => (
              <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition ${pathname === href ? 'bg-bg-gray text-text-primary' : 'text-text-secondary hover:bg-bg-gray hover:text-text-primary'}`}>
                <span className="text-xs font-bold w-7">{icon}</span><span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
            <div className="hidden md:block h-px bg-border-gray my-4" />
            <Link href="/billing" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-text-secondary hover:bg-bg-gray"><span className="text-xs font-bold w-7">$</span><span className="text-sm font-medium">Billing</span></Link>
            <Link href="/usage" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-text-secondary hover:bg-bg-gray"><span className="text-xs font-bold w-7">US</span><span className="text-sm font-medium">Usage History</span></Link>
          </nav>
          <div className="hidden md:block p-4 border-t border-border-gray">
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-md p-4 border border-orange-200">
              <div className="text-sm font-semibold text-text-primary mb-2">Credits remaining</div>
              <div className="text-2xl font-bold mb-3">{usage?.credits.remaining ?? '-'}</div>
              <Link href="/billing" className="block text-center w-full bg-text-primary text-white text-sm font-medium py-2 rounded-sm">Upgrade</Link>
            </div>
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </AuthGuard>
  );
}
