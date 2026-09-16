const assert = require('node:assert/strict');
const test = require('node:test');
const { BillingService } = require('../dist/modules/billing/billing.service');
const {
  createForwardedWebhookSignature,
} = require('../dist/modules/billing/stripe-webhook-forwarding');

const forwardingSecret = 'test-forwarding-secret-with-at-least-32-characters';

function createService({ existingEvent = null } = {}) {
  const config = {
    get(name) {
      return {
        FRONTEND_ORIGIN: 'https://sheetgpt.io',
        STRIPE_APPLICATION_ID: 'sheetgpt',
        STRIPE_WEBHOOK_FORWARDING_SECRET: forwardingSecret,
        STRIPE_WEBHOOK_FORWARDING_TOLERANCE_SECONDS: '300',
      }[name];
    },
  };
  const calls = { createdCheckout: null, createdEvent: null, eventUpdates: [] };
  const prisma = {
    billingWebhookEvent: {
      findUnique: async () => existingEvent,
      create: async ({ data }) => {
        calls.createdEvent = data;
        return data;
      },
      update: async ({ data }) => {
        calls.eventUpdates.push(data);
        return data;
      },
    },
  };
  const service = new BillingService(config, prisma, {});
  service.stripeClient = {
    checkout: {
      sessions: {
        create: async (input) => {
          calls.createdCheckout = input;
          return { id: 'cs_test', url: 'https://checkout.stripe.test/session' };
        },
      },
    },
  };
  return { service, calls };
}

test('writes the application ID to checkout and subscription metadata', async () => {
  const { service, calls } = createService();
  await service.createCheckoutSession(
    { id: '00000000-0000-0000-0000-000000000001', email: 'user@example.com' },
    'pro_monthly',
  );

  assert.equal(calls.createdCheckout.metadata.applicationId, 'sheetgpt');
  assert.equal(calls.createdCheckout.subscription_data.metadata.applicationId, 'sheetgpt');
});

test('accepts a signed event for sheetgpt and persists it once', async () => {
  const { service, calls } = createService();
  const event = {
    id: 'evt_forwarded_test',
    object: 'event',
    type: 'product.updated',
    data: { object: { metadata: { applicationId: 'sheetgpt' } } },
  };
  const rawBody = Buffer.from(JSON.stringify(event));
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createForwardedWebhookSignature(
    rawBody,
    'sheetgpt',
    timestamp,
    forwardingSecret,
  );

  const result = await service.processForwardedStripeWebhook(rawBody, {
    applicationId: 'sheetgpt',
    timestamp,
    signature,
  });

  assert.deepEqual(result, { received: true, duplicate: false, processed: false });
  assert.equal(calls.createdEvent.providerEventId, event.id);
  assert.equal(calls.eventUpdates.at(-1).status, 'processed');
});

test('rejects a correctly signed event belonging to another application', async () => {
  const { service } = createService();
  const event = {
    id: 'evt_wrong_app',
    object: 'event',
    type: 'product.updated',
    data: { object: { metadata: { applicationId: 'editor-image-ai' } } },
  };
  const rawBody = Buffer.from(JSON.stringify(event));
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createForwardedWebhookSignature(
    rawBody,
    'sheetgpt',
    timestamp,
    forwardingSecret,
  );

  await assert.rejects(
    service.processForwardedStripeWebhook(rawBody, {
      applicationId: 'sheetgpt',
      timestamp,
      signature,
    }),
    /belongs to another application/,
  );
});

test('returns duplicate for an event that was already processed', async () => {
  const { service, calls } = createService({ existingEvent: { status: 'processed' } });
  const event = {
    id: 'evt_duplicate',
    object: 'event',
    type: 'product.updated',
    data: { object: { metadata: { applicationId: 'sheetgpt' } } },
  };
  const rawBody = Buffer.from(JSON.stringify(event));
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const result = await service.processForwardedStripeWebhook(rawBody, {
    applicationId: 'sheetgpt',
    timestamp,
    signature: createForwardedWebhookSignature(
      rawBody,
      'sheetgpt',
      timestamp,
      forwardingSecret,
    ),
  });

  assert.deepEqual(result, { received: true, duplicate: true });
  assert.equal(calls.createdEvent, null);
  assert.equal(calls.eventUpdates.length, 0);
});

test('reprocesses an event whose previous attempt failed', async () => {
  const { service, calls } = createService({ existingEvent: { status: 'failed' } });
  const event = {
    id: 'evt_retry',
    object: 'event',
    type: 'product.updated',
    data: { object: { metadata: { applicationId: 'sheetgpt' } } },
  };
  const rawBody = Buffer.from(JSON.stringify(event));
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const result = await service.processForwardedStripeWebhook(rawBody, {
    applicationId: 'sheetgpt',
    timestamp,
    signature: createForwardedWebhookSignature(
      rawBody,
      'sheetgpt',
      timestamp,
      forwardingSecret,
    ),
  });

  assert.equal(result.duplicate, false);
  assert.deepEqual(
    calls.eventUpdates.map((update) => update.status),
    ['received', 'processed'],
  );
});
