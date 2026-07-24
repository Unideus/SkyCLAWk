'use strict';

const crypto = require('node:crypto');

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

class DownloadTokens {
  constructor(secret, clock = () => Date.now()) {
    if (typeof secret !== 'string' || secret.length < 32) {
      throw new Error('Download token secret must contain at least 32 characters');
    }
    this.secret = secret;
    this.clock = clock;
  }

  issue(orderId, expiresAt) {
    const payload = base64UrlJson({
      orderId,
      expiresAt: new Date(expiresAt).getTime(),
      nonce: crypto.randomBytes(8).toString('base64url'),
    });
    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  verify(token, expectedOrderId) {
    const [payload, signature, extra] = String(token || '').split('.');
    if (!payload || !signature || extra) return false;
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
    if (!safeEqual(signature, expectedSignature)) return false;

    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      return (
        decoded.orderId === expectedOrderId &&
        Number.isFinite(decoded.expiresAt) &&
        decoded.expiresAt > this.clock()
      );
    } catch (_error) {
      return false;
    }
  }
}

function strictCors(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.get('Origin');
    if (!origin) return next();
    if (!allowed.has(origin)) {
      return res.status(403).json({ error: 'origin_not_allowed' });
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  };
}

module.exports = {
  DownloadTokens,
  strictCors,
};
