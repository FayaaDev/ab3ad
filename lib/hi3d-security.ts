import crypto from 'node:crypto';

function getAllowedHosts() {
  return (process.env.HI3D_ALLOWED_RESULT_HOSTS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function verifyHi3DCallbackSignature(rawBody: string, headers: Headers) {
  const secret = process.env.HI3D_CALLBACK_SECRET;
  const allowUnsigned = process.env.HI3D_ALLOW_UNSIGNED_CALLBACKS === 'true' || (process.env.HI3D_MODE ?? 'mock') === 'mock';

  if (!secret) {
    return allowUnsigned;
  }

  const authorization = headers.get('authorization');
  if (authorization === `Bearer ${secret}`) {
    return true;
  }

  const directSecret = headers.get('x-hi3d-callback-secret');
  if (directSecret === secret) {
    return true;
  }

  const signature = headers.get('x-hi3d-signature');
  if (!signature) {
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const normalized = signature.startsWith('sha256=') ? signature.slice('sha256='.length) : signature;
  return normalized === expected;
}

export function assertTrustedResultUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported result URL protocol: ${url.protocol}`);
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('Result download URLs must use HTTPS in production.');
  }

  const allowedHosts = getAllowedHosts();
  if (allowedHosts.length && !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error(`Untrusted result URL host: ${url.hostname}`);
  }
}
