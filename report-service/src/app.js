'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { ReportCoordinator } = require('./coordinator');
const { ServiceError } = require('./integrations');
const { createSafeLogger } = require('./logger');
const { OrderStore } = require('./order-store');
const { DownloadTokens, strictCors } = require('./security');
const {
  validOrderId,
  validStripeSessionId,
  validateCheckoutInput,
} = require('./validation');

function createSystem({
  config,
  stripe,
  geocoder,
  timezoneResolver,
  generator,
  mailer,
  mailerLite,
  logger = createSafeLogger(console, config.logLevel),
  clock = () => Date.now(),
  idFactory,
}) {
  const store = new OrderStore({
    ...config.storage,
    retentionMs: config.retentionMs,
    clock,
    logger,
  });
  const downloadTokens = new DownloadTokens(config.downloadTokenSecret, clock);
  const coordinator = new ReportCoordinator({
    config,
    stripe,
    store,
    geocoder,
    timezoneResolver,
    generator,
    mailer,
    mailerLite,
    downloadTokens,
    logger,
    clock,
    idFactory,
  });
  const app = createApp({
    config,
    stripe,
    store,
    coordinator,
    downloadTokens,
    logger,
    integrations: { geocoder, generator, mailer, mailerLite },
    clock,
  });

  return {
    app,
    coordinator,
    store,
    async start() {
      store.startCleanup(config.cleanupIntervalMs);
      await coordinator.recover();
    },
    async stop() {
      store.stopCleanup();
      await coordinator.onIdle();
    },
  };
}

function createApp({
  config,
  stripe,
  store,
  coordinator,
  downloadTokens,
  logger,
  integrations,
  clock,
}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(strictCors(config.allowedOrigins));

  // This route must precede express.json(): Stripe signs the exact raw bytes.
  app.post(
    '/api/stripe-webhook',
    express.raw({ type: 'application/json', limit: '256kb' }),
    (req, res) => {
      let event;
      try {
        const signature = req.get('stripe-signature');
        if (!signature) throw new Error('Missing signature');
        event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          config.stripe.webhookSecret
        );
      } catch (error) {
        logger.warn('stripe_webhook_rejected', { error });
        return res.status(400).json({ error: 'invalid_webhook_signature' });
      }

      if (
        event.type === 'checkout.session.completed' ||
        event.type === 'checkout.session.async_payment_succeeded'
      ) {
        coordinator.acceptPaidSession(event.data.object, event.id);
      }
      logger.info('stripe_webhook_received', { eventType: event.type });
      return res.json({ received: true });
    }
  );

  app.use(express.json({ limit: '32kb', strict: true }));

  app.get('/healthz', (_req, res) => {
    const queue = coordinator.queueState();
    res.json({
      status: 'ok',
      service: 'zodi-yuga-cosmic-report-service',
      queue,
      configured: {
        stripe: Boolean(stripe),
        generator: Boolean(integrations.generator.configured ?? true),
        geocoding: Boolean(integrations.geocoder.configured ?? true),
        smtp: Boolean(integrations.mailer.configured),
        mailerLite: Boolean(integrations.mailerLite.configured),
      },
      salesEnabled: config.salesEnabled === true,
    });
  });

  app.post('/api/cosmic-report/checkout', async (req, res, next) => {
    try {
      if (!config.salesEnabled) {
        return res.status(503).json({ error: 'sales_temporarily_disabled' });
      }
      const validated = validateCheckoutInput(req.body, new Date(clock()));
      if (!validated.ok) {
        return res.status(400).json({
          error: 'invalid_checkout_details',
          fields: validated.errors,
        });
      }
      const checkout = await coordinator.createCheckout(validated.value);
      return res.status(201).json({
        ok: true,
        checkoutUrl: checkout.checkoutUrl,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/cosmic-report/order-status', async (req, res) => {
    const sessionId = String(req.query.session_id || '');
    if (!validStripeSessionId(sessionId)) {
      return res.status(400).json({ error: 'invalid_session_id' });
    }
    try {
      const order = await coordinator.statusFromStripeSession(sessionId);
      if (!order) return res.status(404).json({ error: 'order_not_found' });
      const payload = {
        status: order.status,
        emailed: order.delivery?.emailStatus === 'sent',
        expiresAt: order.expiresAt,
      };
      if (order.status === 'ready') {
        payload.downloadUrl = coordinator.downloadUrl(order);
      }
      if (order.status === 'failed') {
        payload.message =
          'Report generation needs attention. Please contact Zodi Yuga support with your Stripe receipt.';
      }
      if (order.status === 'expired_unfulfilled') {
        payload.message =
          'This paid order could not be fulfilled inside the privacy retention window. Its birth data was deleted; please contact Zodi Yuga support with your Stripe receipt for resolution.';
      }
      return res.json(payload);
    } catch (error) {
      logger.warn('order_status_lookup_failed', { error });
      return res.status(404).json({ error: 'order_not_found' });
    }
  });

  app.get('/api/cosmic-report/download/:orderId', (req, res) => {
    const orderId = String(req.params.orderId || '');
    const token = String(req.query.token || '');
    if (!validOrderId(orderId) || !downloadTokens.verify(token, orderId)) {
      return res.status(403).json({ error: 'invalid_or_expired_download' });
    }
    const order = store.get(orderId);
    if (
      !order ||
      order.status !== 'ready' ||
      !order.pdfFilename ||
      new Date(order.expiresAt).getTime() <= clock()
    ) {
      return res.status(404).json({ error: 'report_not_found' });
    }
    const filePath = path.join(store.outputDir, path.basename(order.pdfFilename));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'report_not_found' });
    }
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return res.download(
      filePath,
      order.language === 'es'
        ? 'informe-de-historia-cosmica.pdf'
        : 'cosmic-history-report.pdf'
    );
  });

  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof ServiceError) {
      const payload = { error: error.code };
      if (Array.isArray(error.allowedUtcOffsets)) {
        payload.allowedUtcOffsets = error.allowedUtcOffsets;
      }
      if (error.resolvedLocation) {
        payload.resolvedLocation = error.resolvedLocation;
      }
      if (error.timeZone) {
        payload.timeZone = error.timeZone;
      }
      return res.status(error.httpStatus).json(payload);
    }
    if (error instanceof SyntaxError && error.status === 400) {
      return res.status(400).json({ error: 'invalid_json' });
    }
    logger.error('request_failed', { error });
    return res.status(502).json({ error: 'service_unavailable' });
  });

  return app;
}

module.exports = {
  createApp,
  createSystem,
};
