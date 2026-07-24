'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const request = require('supertest');

const { createSystem } = require('../src/app');
const { SEVEN_DAYS_MS } = require('../src/config');
const {
  MailerLiteClient,
  REPORT_SUPPORTED_START_UTC_MS,
  ServiceError,
} = require('../src/integrations');

function validCustomer(overrides = {}) {
  return {
    name: 'Accuracy Tester',
    email: 'accuracy@example.com',
    location: 'Jacksonville, Florida',
    confirmedLocation: 'Jacksonville, Florida, United States',
    year: 1982,
    month: 5,
    day: 2,
    hour: 2,
    min: 16,
    lang: 'en',
    marketingConsent: true,
    marketingConsentVersion: 'cosmic-report-consent-2026-07',
    marketingConsentSource: 'cosmic-report-checkout',
    attribution: {
      utm_source: 'youtube',
      utm_medium: 'video',
      utm_campaign: 'sky-remembers',
    },
    ...overrides,
  };
}

function createStripeMock() {
  const created = [];
  const sessions = new Map();
  return {
    created,
    sessions,
    checkout: {
      sessions: {
        async create(params, options) {
          const id = `cs_test_session_${created.length + 1}`;
          const session = {
            id,
            url: `https://checkout.stripe.test/${id}`,
            payment_status: 'unpaid',
            amount_total: 1900,
            currency: 'usd',
            metadata: params.metadata,
          };
          created.push({ params, options, session });
          sessions.set(id, session);
          return session;
        },
        async retrieve(id) {
          const session = sessions.get(id);
          if (!session) throw new Error('missing_session');
          return session;
        },
      },
    },
    webhooks: {
      constructEvent(rawBody, signature, secret) {
        assert.ok(Buffer.isBuffer(rawBody), 'webhook body must remain raw');
        assert.equal(signature, 'valid-signature');
        assert.equal(secret, 'whsec_test');
        return JSON.parse(rawBody.toString('utf8'));
      },
    },
    markPaid(id) {
      const session = sessions.get(id);
      session.payment_status = 'paid';
      return session;
    },
  };
}

async function createFixture(t, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zodi-report-service-'));
  const now = Date.UTC(2026, 6, 23, 12, 0, 0);
  const stripe = overrides.stripe || createStripeMock();
  const geocoder = overrides.geocoder || {
    configured: true,
    calls: [],
    async resolve(location, lang) {
      this.calls.push({ location, lang });
      return {
        latitude: 30.22,
        longitude: -81.68,
        label: 'Jacksonville, Florida, United States',
        provider: 'mock',
      };
    },
  };
  const timezoneResolver = overrides.timezoneResolver || {
    calls: [],
    resolve(birth, coordinates) {
      this.calls.push({ birth, coordinates });
      return {
        timeZone: 'America/New_York',
        timeZoneLabel: 'EDT',
        utcOffsetHoursForEngine: 4,
        utcTimestampMs: Date.UTC(1982, 4, 2, 6, 16),
      };
    },
  };
  const generator = overrides.generator || {
    configured: true,
    calls: [],
    async generate(input) {
      this.calls.push(input);
      fs.writeFileSync(input.targetPath, '%PDF-1.7\nmock report\n');
    },
  };
  const mailer = overrides.mailer || {
    configured: true,
    calls: [],
    async sendReport(input) {
      this.calls.push(input);
    },
  };
  const mailerLite = overrides.mailerLite || {
    configured: true,
    calls: [],
    async addPaid(input) {
      this.calls.push(input);
    },
  };
  let idCounter = 0;
  const config = {
    nodeEnv: 'test',
    trustProxy: 0,
    logLevel: 'silent',
    publicApiUrl: 'https://reports.zodiyuga.com',
    landingBaseUrl: 'https://zodiyuga.com/cosmic-report',
    allowedOrigins: ['https://zodiyuga.com', 'https://www.zodiyuga.com'],
    salesEnabled: true,
    retentionMs: SEVEN_DAYS_MS,
    cleanupIntervalMs: 60 * 60 * 1000,
    stripe: {
      secretKey: 'sk_test_mock',
      webhookSecret: 'whsec_test',
      priceId: 'price_cosmic_fixed',
    },
    downloadTokenSecret: 'test-only-download-secret-with-32-characters',
    storage: {
      ordersDir: path.join(root, 'orders'),
      outputDir: path.join(root, 'reports'),
    },
  };
  const logger = {
    info() {},
    warn() {},
    error() {},
  };
  const system = createSystem({
    config,
    stripe,
    geocoder,
    timezoneResolver,
    generator,
    mailer,
    mailerLite,
    logger,
    clock: () => now,
    idFactory: () => {
      idCounter += 1;
      return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
    },
  });
  await system.start();
  t.after(async () => {
    await system.stop();
    fs.rmSync(root, { recursive: true, force: true });
  });
  return {
    system,
    stripe,
    geocoder,
    timezoneResolver,
    generator,
    mailer,
    mailerLite,
  };
}

test('checkout -> signed webhook -> ready -> tokenized download scrubs birth details', async (t) => {
  const fixture = await createFixture(t);
  const checkout = await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .set('Origin', 'https://zodiyuga.com')
    .send(validCustomer())
    .expect(201);

  assert.match(checkout.body.checkoutUrl, /^https:\/\/checkout\.stripe\.test\//);
  const stripeCall = fixture.stripe.created[0];
  assert.equal(stripeCall.params.line_items[0].price, 'price_cosmic_fixed');
  assert.equal(stripeCall.params.allow_promotion_codes, undefined);
  assert.equal(stripeCall.params.metadata.utm_source, 'youtube');
  assert.equal(stripeCall.params.metadata.marketing_consent, 'yes');
  assert.equal(
    stripeCall.params.metadata.consent_version,
    'cosmic-report-consent-2026-07'
  );
  assert.equal(stripeCall.params.metadata.name, undefined);
  assert.equal(stripeCall.params.metadata.location, undefined);
  assert.equal(stripeCall.params.metadata.email, undefined);
  assert.equal(
    stripeCall.params.success_url,
    'https://zodiyuga.com/cosmic-report/thank-you.html?session_id={CHECKOUT_SESSION_ID}&lang=en'
  );
  assert.equal(
    stripeCall.params.cancel_url,
    'https://zodiyuga.com/cosmic-report/?checkout=cancelled#order'
  );

  const paidSession = fixture.stripe.markPaid(stripeCall.session.id);
  const webhookEvent = {
    id: 'evt_paid_1',
    type: 'checkout.session.completed',
    data: { object: paidSession },
  };
  await request(fixture.system.app)
    .post('/api/stripe-webhook')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', 'valid-signature')
    .send(webhookEvent)
    .expect(200);
  await fixture.system.coordinator.onIdle();

  const orderId = stripeCall.params.metadata.order_id;
  const stored = fixture.system.store.get(orderId);
  assert.equal(stored.status, 'ready');
  assert.equal(stored.birthData, undefined);
  assert.ok(stored.birthDataScrubbedAt);
  assert.equal(stored.delivery.emailStatus, 'sent');
  assert.equal(stored.delivery.mailerLiteStatus, 'sent');
  assert.equal(fixture.generator.calls.length, 1);
  assert.equal(fixture.mailer.calls.length, 1);
  assert.equal(fixture.mailerLite.calls.length, 1);

  const status = await request(fixture.system.app)
    .get('/api/cosmic-report/order-status')
    .query({ session_id: stripeCall.session.id })
    .expect(200);
  assert.equal(status.body.status, 'ready');
  const download = new URL(status.body.downloadUrl);
  assert.equal(download.origin, 'https://reports.zodiyuga.com');

  const response = await request(fixture.system.app)
    .get(`${download.pathname}${download.search}`)
    .expect(200);
  assert.equal(response.headers['content-type'], 'application/pdf');
  assert.equal(response.body.subarray(0, 5).toString('ascii'), '%PDF-');

  const badToken = new URL(status.body.downloadUrl);
  badToken.searchParams.set('token', `${badToken.searchParams.get('token')}x`);
  await request(fixture.system.app)
    .get(`${badToken.pathname}${badToken.search}`)
    .expect(403);
});

test('paid-session status fallback fulfills a no-consent order without MailerLite', async (t) => {
  const fixture = await createFixture(t);
  await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(
      validCustomer({
        lang: 'es',
        marketingConsent: false,
        marketingConsentVersion: undefined,
        marketingConsentSource: undefined,
      })
    )
    .expect(201);

  const stripeCall = fixture.stripe.created[0];
  assert.equal(stripeCall.params.metadata.marketing_consent, 'no');
  assert.equal(stripeCall.params.metadata.consent_version, undefined);
  assert.equal(
    stripeCall.params.success_url,
    'https://zodiyuga.com/cosmic-report/thank-you.html?session_id={CHECKOUT_SESSION_ID}&lang=es'
  );
  assert.equal(
    stripeCall.params.cancel_url,
    'https://zodiyuga.com/cosmic-report/index_es.html?checkout=cancelled#order'
  );
  fixture.stripe.markPaid(stripeCall.session.id);

  await request(fixture.system.app)
    .get('/api/cosmic-report/order-status')
    .query({ session_id: stripeCall.session.id })
    .expect(200);
  await fixture.system.coordinator.onIdle();

  const status = await request(fixture.system.app)
    .get('/api/cosmic-report/order-status')
    .query({ session_id: stripeCall.session.id })
    .expect(200);
  assert.equal(status.body.status, 'ready');
  assert.equal(fixture.mailer.calls.length, 1, 'transactional email is independent');
  assert.equal(fixture.mailerLite.calls.length, 0, 'no consent means no marketing sync');
});

test('checkout requires confirmation of the canonical location before calling Stripe', async (t) => {
  const fixture = await createFixture(t);

  const missing = await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(validCustomer({ confirmedLocation: undefined }))
    .expect(409);
  assert.deepEqual(missing.body, {
    error: 'location_confirmation_required',
    resolvedLocation: 'Jacksonville, Florida, United States',
    timeZone: 'America/New_York',
  });

  const mismatched = await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(validCustomer({ confirmedLocation: 'Jacksonville, North Carolina' }))
    .expect(409);
  assert.deepEqual(mismatched.body, {
    error: 'location_confirmation_required',
    resolvedLocation: 'Jacksonville, Florida, United States',
    timeZone: 'America/New_York',
  });

  assert.equal(fixture.geocoder.calls.length, 2);
  assert.equal(fixture.timezoneResolver.calls.length, 2);
  assert.equal(
    fixture.stripe.created.length,
    0,
    'Stripe must not be called until the customer confirms the resolved place'
  );
});

test('impossible dates and failed fulfillment preflight cannot reach Stripe', async (t) => {
  const geocoder = {
    configured: true,
    calls: [],
    async resolve(location) {
      this.calls.push(location);
      throw new ServiceError('location_not_found', 422);
    },
  };
  const fixture = await createFixture(t, { geocoder });

  const impossible = await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(validCustomer({ year: 2025, month: 2, day: 30 }))
    .expect(400);
  assert.ok(impossible.body.fields.includes('date'));
  assert.equal(geocoder.calls.length, 0);
  assert.equal(fixture.stripe.created.length, 0);

  const incompleteConsent = await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(
      validCustomer({
        marketingConsent: true,
        marketingConsentVersion: '',
        marketingConsentSource: '',
      })
    )
    .expect(400);
  assert.ok(incompleteConsent.body.fields.includes('marketingConsentRecord'));
  assert.equal(geocoder.calls.length, 0);
  assert.equal(fixture.stripe.created.length, 0);

  await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(validCustomer())
    .expect(422)
    .expect({ error: 'location_not_found' });
  assert.equal(fixture.stripe.created.length, 0);
});

test('timezone/DST preflight failure prevents checkout and returns a useful error', async (t) => {
  const timezoneResolver = {
    resolve() {
      const error = new ServiceError('ambiguous_local_time', 422);
      error.allowedUtcOffsets = [-300, -240];
      throw error;
    },
  };
  const fixture = await createFixture(t, { timezoneResolver });
  const response = await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(validCustomer())
    .expect(422);

  assert.equal(response.body.error, 'ambiguous_local_time');
  assert.deepEqual(response.body.allowedUtcOffsets, [-300, -240]);
  assert.equal(fixture.stripe.created.length, 0);
});

test('report support boundary rejects one millisecond before it and accepts the exact instant', async (t) => {
  const resolvedTimestamps = [
    REPORT_SUPPORTED_START_UTC_MS - 1,
    REPORT_SUPPORTED_START_UTC_MS,
  ];
  const timezoneResolver = {
    calls: [],
    resolve(birth, coordinates) {
      this.calls.push({ birth, coordinates });
      return {
        timeZone: 'America/New_York',
        timeZoneLabel: 'EDT',
        utcOffsetHoursForEngine: 4,
        utcTimestampMs: resolvedTimestamps[this.calls.length - 1],
      };
    },
  };
  const fixture = await createFixture(t, { timezoneResolver });

  await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(validCustomer())
    .expect(422)
    .expect({ error: 'birth_date_not_supported' });
  assert.equal(
    fixture.stripe.created.length,
    0,
    'a birth instant before the engine boundary must never reach Stripe'
  );

  await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(validCustomer())
    .expect(201);
  assert.equal(timezoneResolver.calls.length, 2);
  assert.equal(
    fixture.stripe.created.length,
    1,
    'the exact supported boundary must be eligible for checkout'
  );
});

test('strict CORS rejects foreign origins and webhook rejects bad signatures', async (t) => {
  const fixture = await createFixture(t);
  await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .set('Origin', 'https://not-zodiyuga.example')
    .send(validCustomer())
    .expect(403)
    .expect({ error: 'origin_not_allowed' });

  await request(fixture.system.app)
    .post('/api/stripe-webhook')
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', 'bad-signature')
    .send({ type: 'checkout.session.completed' })
    .expect(400)
    .expect({ error: 'invalid_webhook_signature' });
});

test('the generation worker is strictly serial', async (t) => {
  let active = 0;
  let maximumActive = 0;
  const generator = {
    configured: true,
    calls: [],
    async generate(input) {
      this.calls.push(input);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      fs.writeFileSync(input.targetPath, '%PDF-1.7\nserial mock\n');
      active -= 1;
    },
  };
  const fixture = await createFixture(t, { generator });

  await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(validCustomer({ email: 'one@example.com' }))
    .expect(201);
  await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(validCustomer({ email: 'two@example.com' }))
    .expect(201);

  for (const call of fixture.stripe.created) {
    fixture.stripe.markPaid(call.session.id);
    fixture.system.coordinator.acceptPaidSession(call.session, 'evt_serial');
  }
  await fixture.system.coordinator.onIdle();
  assert.equal(generator.calls.length, 2);
  assert.equal(maximumActive, 1);
});

test('retention cleanup cannot be undone by a renderer that finishes after expiry', async (t) => {
  let signalGenerationStarted;
  let releaseGenerator;
  const generationStarted = new Promise((resolve) => {
    signalGenerationStarted = resolve;
  });
  const generatorReleased = new Promise((resolve) => {
    releaseGenerator = resolve;
  });
  const generator = {
    configured: true,
    calls: [],
    async generate(input) {
      this.calls.push(input);
      signalGenerationStarted();
      await generatorReleased;
      fs.writeFileSync(input.targetPath, '%PDF-1.7\nlate report\n');
    },
  };
  const fixture = await createFixture(t, { generator });

  await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(validCustomer())
    .expect(201);
  const stripeCall = fixture.stripe.created[0];
  const orderId = stripeCall.params.metadata.order_id;
  const paidSession = fixture.stripe.markPaid(stripeCall.session.id);
  fixture.system.coordinator.acceptPaidSession(paidSession, 'evt_retention_race');

  await generationStarted;
  try {
    assert.equal(fixture.system.store.get(orderId).status, 'generating');
    fixture.system.store.update(orderId, (order) => ({
      ...order,
      expiresAt: new Date(Date.UTC(2026, 6, 23, 12, 0, 0)).toISOString(),
    }));
    assert.equal(fixture.system.store.cleanupExpired(), 0);
    assert.equal(
      fixture.system.store.get(orderId).status,
      'expired_unfulfilled'
    );
  } finally {
    releaseGenerator();
  }

  await fixture.system.coordinator.onIdle();
  const order = fixture.system.store.get(orderId);
  const partialPath = path.join(
    fixture.system.store.outputDir,
    `${orderId}.partial.pdf`
  );
  const finalPath = path.join(fixture.system.store.outputDir, `${orderId}.pdf`);

  assert.equal(order.status, 'expired_unfulfilled');
  assert.equal(order.failureCode, 'retention_window_expired');
  assert.equal(order.birthData, undefined);
  assert.equal(order.pdfFilename, undefined);
  assert.equal(fs.existsSync(partialPath), false);
  assert.equal(fs.existsSync(finalPath), false);
  assert.equal(fixture.mailer.calls.length, 0);
  assert.equal(fixture.mailerLite.calls.length, 0);
});

test('restart recovery resumes an interrupted order within retention and cleanup removes it at the ceiling', async (t) => {
  const fixture = await createFixture(t);
  await request(fixture.system.app)
    .post('/api/cosmic-report/checkout')
    .send(validCustomer())
    .expect(201);
  const stripeCall = fixture.stripe.created[0];
  const orderId = stripeCall.params.metadata.order_id;
  fixture.system.store.update(orderId, (order) => ({
    ...order,
    status: 'generating',
    paidAt: new Date(Date.UTC(2026, 6, 23, 12, 0, 0)).toISOString(),
    expiresAt: new Date(Date.UTC(2026, 6, 23, 12, 0, 0, 1)).toISOString(),
  }));
  assert.equal(
    fixture.system.store.cleanupExpired(),
    0,
    'an interrupted generation remains recoverable while its retention window is active'
  );
  assert.ok(fixture.system.store.get(orderId));

  await fixture.system.coordinator.recover();
  await fixture.system.coordinator.onIdle();
  const ready = fixture.system.store.get(orderId);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.birthData, undefined);
  const pdfPath = path.join(fixture.system.store.outputDir, ready.pdfFilename);
  assert.ok(fs.existsSync(pdfPath));

  fixture.system.store.update(orderId, (order) => ({
    ...order,
    expiresAt: new Date(Date.UTC(2026, 6, 23, 12, 0, 0)).toISOString(),
  }));
  assert.equal(fixture.system.store.cleanupExpired(), 1);
  assert.equal(fixture.system.store.get(orderId), null);
  assert.equal(fs.existsSync(pdfPath), false);
});

test('stale paid and generating orders are scrubbed at the seven-day ceiling and report an actionable status', async (t) => {
  const fixture = await createFixture(t);
  const statuses = ['paid', 'generating'];
  const staleOrders = [];

  for (const [index, status] of statuses.entries()) {
    await request(fixture.system.app)
      .post('/api/cosmic-report/checkout')
      .send(validCustomer({ email: `stale-${status}@example.com` }))
      .expect(201);

    const stripeCall = fixture.stripe.created[index];
    const orderId = stripeCall.params.metadata.order_id;
    fixture.stripe.markPaid(stripeCall.session.id);
    fixture.system.store.update(orderId, (order) => ({
      ...order,
      status,
      paidAt: new Date(Date.UTC(2026, 6, 16, 12, 0, 0)).toISOString(),
      expiresAt: new Date(Date.UTC(2026, 6, 23, 12, 0, 0)).toISOString(),
      pdfFilename: `${orderId}.pdf`,
    }));

    const partialPath = path.join(
      fixture.system.store.outputDir,
      `${orderId}.partial.pdf`
    );
    const finalPath = path.join(fixture.system.store.outputDir, `${orderId}.pdf`);
    fs.writeFileSync(partialPath, '%PDF-1.7\nstale partial\n');
    fs.writeFileSync(finalPath, '%PDF-1.7\nstale final\n');
    staleOrders.push({ orderId, sessionId: stripeCall.session.id, partialPath, finalPath });
  }

  assert.equal(
    fixture.system.store.cleanupExpired(),
    0,
    'expired paid work is retained only as a scrubbed resolution record'
  );

  for (const stale of staleOrders) {
    const order = fixture.system.store.get(stale.orderId);
    assert.equal(order.status, 'expired_unfulfilled');
    assert.equal(order.failureCode, 'retention_window_expired');
    assert.equal(
      order.expiredAt,
      new Date(Date.UTC(2026, 6, 23, 12, 0, 0)).toISOString()
    );
    assert.equal(
      order.birthDataScrubbedAt,
      new Date(Date.UTC(2026, 6, 23, 12, 0, 0)).toISOString()
    );
    assert.equal(order.birthData, undefined);
    assert.equal(order.pdfFilename, undefined);
    assert.equal(fs.existsSync(stale.partialPath), false);
    assert.equal(fs.existsSync(stale.finalPath), false);

    const response = await request(fixture.system.app)
      .get('/api/cosmic-report/order-status')
      .query({ session_id: stale.sessionId })
      .expect(200);
    assert.equal(response.body.status, 'expired_unfulfilled');
    assert.match(response.body.message, /birth data was deleted/i);
    assert.match(response.body.message, /Stripe receipt/i);
    assert.equal(response.body.downloadUrl, undefined);
  }
});

test('MailerLite paid routing selects the configured EN and ES groups', async () => {
  const bodies = [];
  const client = new MailerLiteClient(
    {
      enabled: true,
      apiKey: 'test-key',
      paidGroups: { en: 'paid-en', es: 'paid-es' },
    },
    async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      return { ok: true };
    }
  );

  await client.addPaid({ email: 'en@example.com', name: '', lang: 'en' });
  await client.addPaid({ email: 'es@example.com', name: '', lang: 'es' });
  assert.deepEqual(bodies[0].groups, ['paid-en']);
  assert.deepEqual(bodies[1].groups, ['paid-es']);
});
