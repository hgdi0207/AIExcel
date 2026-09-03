'use client';

import { useEffect, useState } from 'react';
import { createBillingCheckout, createBillingPortalSession, getBillingSummary } from '@/lib/api';
import type { BillingSummary } from '@/lib/types';
import { PageHeader } from '@/components/page-header';

const PLANS = [
  {
    planCode: 'pro_monthly',
    name: 'Pro',
    priceLabel: '$9 / month',
    credits: 120,
    description: 'For regular spreadsheet work and moderate usage.',
  },
  {
    planCode: 'pro_plus_monthly',
    name: 'Pro Plus',
    priceLabel: '$18 / month',
    credits: 300,
    description: 'For heavy spreadsheet work and larger workloads.',
  },
] as const;

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<'pro_monthly' | 'pro_plus_monthly' | 'portal' | ''>('');

  useEffect(() => {
    const refreshSummary = () => {
      void getBillingSummary()
        .then(setSummary)
        .catch((err: Error) => setError(err.message));
    };

    refreshSummary();

    const handleFocus = () => {
      refreshSummary();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const checkoutStatus = new URLSearchParams(window.location.search).get('checkout');
    if (checkoutStatus === 'success') {
      void getBillingSummary()
        .then(setSummary)
        .catch((err: Error) => setError(err.message));
    }
  }, []);

  async function handleCheckout(planCode: 'pro_monthly' | 'pro_plus_monthly') {
    setPendingAction(planCode);
    setError('');
    try {
      const result = await createBillingCheckout(planCode);
      openExternalUrl(result.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setPendingAction('');
    }
  }

  async function handlePortal() {
    setPendingAction('portal');
    setError('');
    try {
      const result = await createBillingPortalSession();
      openExternalUrl(result.portalUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Billing portal failed');
    } finally {
      setPendingAction('');
    }
  }

  const activePlan = summary?.plan ?? 'free';

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle="Choose a plan, open Stripe checkout, and manage the active subscription from one place."
        badge="Monetization"
      />

      {error ? <div className="empty-state">{error}</div> : null}

      <div className="grid dashboard-grid">
        <div className="panel">
          <h3>Current plan</h3>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatPlanLabel(activePlan)}</div>
          <div className="muted">Subscription status: {summary?.subscriptionStatus ?? 'inactive'}</div>
          <div className="muted">
            Billing cycle end:{' '}
            {summary?.currentPeriodEnd ? formatDateTime(summary.currentPeriodEnd) : 'N/A'}
          </div>
          <div className="muted">
            Auto renew: {summary?.cancelAtPeriodEnd ? 'Off' : 'On'}
          </div>
        </div>

        <div className="panel">
          <h3>Credits</h3>
          <div className="muted">
            Used {summary?.credits.used ?? 0} of {summary?.credits.total ?? 0}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{summary?.credits.remaining ?? 0}</div>
          <div className="muted">Remaining credits this cycle</div>
          {summary?.billingPortalAvailable ? (
            <button
              type="button"
              className="button button-secondary"
              style={{ marginTop: 16 }}
              disabled={pendingAction === 'portal'}
              onClick={() => void handlePortal()}
            >
              {pendingAction === 'portal' ? 'Opening portal...' : 'Manage billing'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {PLANS.map((plan) => {
          const isCurrent =
            summary?.planCode === plan.planCode ||
            (plan.planCode === 'pro_monthly' && summary?.plan === 'pro') ||
            (plan.planCode === 'pro_plus_monthly' && summary?.plan === 'pro_plus');
          const isPending = pendingAction === plan.planCode;

          return (
            <div className="panel" key={plan.planCode}>
              <div className="muted" style={{ marginBottom: 8 }}>
                {isCurrent ? 'Current plan' : 'Upgrade'}
              </div>
              <h3>{plan.name}</h3>
              <div style={{ fontSize: '1.9rem', fontWeight: 800 }}>{plan.priceLabel}</div>
              <div className="muted" style={{ marginTop: 8 }}>
                {plan.credits} monthly credits
              </div>
              <div className="muted" style={{ marginTop: 10 }}>
                {plan.description}
              </div>
              <button
                type="button"
                className="button button-primary"
                style={{ marginTop: 18 }}
                disabled={isPending || isCurrent}
                onClick={() => void handleCheckout(plan.planCode)}
              >
                {isCurrent ? 'Current plan' : isPending ? 'Opening checkout...' : `Upgrade to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function openExternalUrl(url: string) {
  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (!popup) {
    window.location.href = url;
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPlanLabel(plan: string) {
  if (plan === 'pro_plus') {
    return 'Pro Plus';
  }
  if (plan === 'pro') {
    return 'Pro';
  }
  return 'Free';
}
