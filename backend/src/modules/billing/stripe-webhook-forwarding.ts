import { createHmac, timingSafeEqual } from 'crypto';

type RawWebhookBody = Buffer | string;

export type ForwardedWebhookVerificationInput = {
  rawBody: RawWebhookBody;
  applicationId: string;
  timestamp: string;
  signature: string;
  secret: string;
  toleranceSeconds: number;
  nowSeconds?: number;
};

function toRawBodyBuffer(rawBody: RawWebhookBody) {
  return Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
}

export function createForwardedWebhookSignature(
  rawBody: RawWebhookBody,
  applicationId: string,
  timestamp: string,
  secret: string,
) {
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${applicationId}.`, 'utf8')
    .update(toRawBodyBuffer(rawBody))
    .digest('hex');
  return `v1=${digest}`;
}

export function verifyForwardedWebhookSignature(input: ForwardedWebhookVerificationInput) {
  if (!/^\d+$/.test(input.timestamp)) {
    return false;
  }

  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > input.toleranceSeconds
  ) {
    return false;
  }

  const expectedSignature = createForwardedWebhookSignature(
    input.rawBody,
    input.applicationId,
    input.timestamp,
    input.secret,
  ).slice(3);
  const candidates = input.signature
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.startsWith('v1='))
    .map((value) => value.slice(3));

  return candidates.some((candidate) => {
    if (!/^[a-f0-9]{64}$/i.test(candidate)) {
      return false;
    }

    const actual = Buffer.from(candidate, 'hex');
    const expected = Buffer.from(expectedSignature, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
