import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="topbar">
      <div>
        {badge ? <div className="badge">{badge}</div> : null}
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {actions}
        <div className="avatar">AX</div>
      </div>
    </div>
  );
}
