const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createForwardedWebhookSignature,
  verifyForwardedWebhookSignature,
} = require('../dist/modules/billing/stripe-webhook-forwarding');

const rawBody = Buffer.from('{"id":"evt_test","type":"checkout.session.completed"}');
const secret = 'test-forwarding-secret';
const applicationId = 'sheetgpt';
const timestamp = '1789495200';

function verify(overrides = {}) {
  return verifyForwardedWebhookSignature({
    rawBody,
    secret,
    applicationId,
    timestamp,
    signature: createForwardedWebhookSignature(rawBody, applicationId, timestamp, secret),
    toleranceSeconds: 300,
    nowSeconds: Number(timestamp),
    ...overrides,
  });
}

test('accepts a valid forwarded webhook signature', () => {
  assert.equal(verify(), true);
});

test('rejects a modified body or application ID', () => {
  assert.equal(verify({ rawBody: Buffer.from('{}') }), false);
  assert.equal(verify({ applicationId: 'another-app' }), false);
});

test('rejects expired and malformed signatures', () => {
  assert.equal(verify({ nowSeconds: Number(timestamp) + 301 }), false);
  assert.equal(verify({ signature: 'v1=not-hex' }), false);
});
