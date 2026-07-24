'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  REPORT_SUPPORTED_START_UTC_MS,
  ServiceError,
} = require('./integrations');
const {
  stripeAttributionMetadata,
  validOrderId,
} = require('./validation');

class SerialQueue {
  constructor() {
    this.tail = Promise.resolve();
    this.pending = 0;
    this.active = 0;
  }

  add(task) {
    this.pending += 1;
    const run = this.tail.then(async () => {
      this.pending -= 1;
      this.active += 1;
      try {
        return await task();
      } finally {
        this.active -= 1;
      }
    });
    this.tail = run.catch(() => undefined);
    return run;
  }

  async onIdle() {
    await this.tail;
  }
}

class ReportCoordinator {
  constructor({
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
    clock = () => Date.now(),
    idFactory = () => crypto.randomUUID(),
  }) {
    this.config = config;
    this.stripe = stripe;
    this.store = store;
    this.geocoder = geocoder;
    this.timezoneResolver = timezoneResolver;
    this.generator = generator;
    this.mailer = mailer;
    this.mailerLite = mailerLite;
    this.downloadTokens = downloadTokens;
    this.logger = logger;
    this.clock = clock;
    this.idFactory = idFactory;
    this.queue = new SerialQueue();
    this.queuedOrders = new Map();
    this.deliveryTasks = new Set();
  }

  async createCheckout(customer) {
    // Resolve every external datum needed by the generator before the customer
    // is sent to Stripe. An unresolvable location or local time must never
    // become a paid, unfulfillable order.
    const coordinates = await this.geocoder.resolve(customer.location, customer.lang);
    const timezone = this.timezoneResolver.resolve(customer, coordinates);
    if (
      Number.isFinite(timezone.utcTimestampMs) &&
      timezone.utcTimestampMs < REPORT_SUPPORTED_START_UTC_MS
    ) {
      throw new ServiceError('birth_date_not_supported', 422);
    }
    if (
      !coordinates.label ||
      locationConfirmationKey(customer.confirmedLocation) !==
        locationConfirmationKey(coordinates.label)
    ) {
      throw new ServiceError('location_confirmation_required', 409, {
        resolvedLocation: coordinates.label || '',
        timeZone: timezone.timeZone,
      });
    }

    const now = this.clock();
    const order = {
      id: this.idFactory(),
      status: 'pending_payment',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.config.retentionMs).toISOString(),
      language: customer.lang,
      attribution: customer.attribution,
      birthData: {
        name: customer.name,
        location: coordinates.label,
        year: customer.year,
        month: customer.month,
        day: customer.day,
        hour: customer.hour,
        minute: customer.minute,
        lang: customer.lang,
        coordinates,
        timezone,
      },
      delivery: {
        email: customer.email,
        emailStatus: this.mailer.configured ? 'pending' : 'not_configured',
        marketingConsent: customer.marketingConsent,
        marketingConsentVersion: customer.marketingConsentVersion,
        marketingConsentSource: customer.marketingConsentSource,
        marketingConsentRecordedAt: customer.marketingConsent
          ? new Date(now).toISOString()
          : null,
        mailerLiteStatus:
          customer.marketingConsent && this.mailerLite.configured
            ? 'pending'
            : customer.marketingConsent
              ? 'not_configured'
              : 'not_requested',
      },
    };
    this.store.write(order);

    try {
      const successPage = `${this.config.landingBaseUrl}/thank-you.html`;
      const cancelPage =
        customer.lang === 'es'
          ? `${this.config.landingBaseUrl}/index_es.html`
          : `${this.config.landingBaseUrl}/`;
      const session = await this.stripe.checkout.sessions.create(
        {
          mode: 'payment',
          customer_email: customer.email,
          client_reference_id: order.id,
          locale: customer.lang === 'es' ? 'es-419' : 'en',
          line_items: [
            {
              price: this.config.stripe.priceId,
              quantity: 1,
            },
          ],
          metadata: {
            type: 'cosmic_report',
            service: 'zodi_yuga_report_service_v1',
            order_id: order.id,
            lang: customer.lang,
            marketing_consent: customer.marketingConsent ? 'yes' : 'no',
            ...(customer.marketingConsent
              ? {
                  consent_version: customer.marketingConsentVersion,
                  consent_source: customer.marketingConsentSource,
                }
              : {}),
            ...stripeAttributionMetadata(customer.attribution),
          },
          success_url: `${successPage}?session_id={CHECKOUT_SESSION_ID}&lang=${customer.lang}`,
          cancel_url: `${cancelPage}?checkout=cancelled#order`,
        },
        { idempotencyKey: `cosmic-report-checkout-${order.id}` }
      );
      if (!session?.id || !session?.url) throw new Error('Invalid Stripe response');
      this.store.update(order.id, (current) => ({
        ...current,
        stripeSessionId: session.id,
      }));
      this.logger.info('checkout_created', { orderId: order.id });
      return {
        orderId: order.id,
        checkoutUrl: session.url,
      };
    } catch (error) {
      // Stripe never accepted this order, so there is no operational reason
      // to retain the customer's birth details.
      this.store.remove(order.id);
      this.logger.error('checkout_creation_failed', { orderId: order.id, error });
      throw error;
    }
  }

  acceptPaidSession(session, eventId = null) {
    const orderId = session?.metadata?.order_id;
    if (
      session?.metadata?.type !== 'cosmic_report' ||
      session?.metadata?.service !== 'zodi_yuga_report_service_v1' ||
      !validOrderId(orderId)
    ) {
      return { accepted: false, reason: 'unrelated_session' };
    }
    const order = this.store.get(orderId);
    if (
      !order ||
      order.stripeSessionId !== session.id ||
      session.payment_status !== 'paid'
    ) {
      return { accepted: false, reason: 'session_mismatch' };
    }

    if (['pending_payment', 'checkout_failed'].includes(order.status)) {
      const paidAt = this.clock();
      this.store.update(orderId, (current) => ({
        ...current,
        status: 'paid',
        paidAt: new Date(paidAt).toISOString(),
        expiresAt: new Date(paidAt + this.config.retentionMs).toISOString(),
        stripeEventId: eventId || current.stripeEventId || null,
        amountTotal: Number.isInteger(session.amount_total)
          ? session.amount_total
          : null,
        currency: String(session.currency || ''),
      }));
      this.logger.info('payment_accepted', { orderId });
    }

    const updated = this.store.get(orderId);
    if (['paid', 'generating'].includes(updated?.status)) this.enqueue(orderId);
    return { accepted: true, order: updated };
  }

  enqueue(orderId) {
    if (this.queuedOrders.has(orderId)) return this.queuedOrders.get(orderId);
    const task = this.queue
      .add(() => this.processOrder(orderId))
      .catch((error) => {
        this.logger.error('report_job_failed', { orderId, error });
      })
      .finally(() => {
        this.queuedOrders.delete(orderId);
      });
    this.queuedOrders.set(orderId, task);
    return task;
  }

  async processOrder(orderId) {
    let order = this.store.get(orderId);
    if (!order || !['paid', 'generating'].includes(order.status) || !order.birthData) {
      return;
    }
    order = this.store.update(orderId, (current) => ({
      ...current,
      status: 'generating',
      generationStartedAt: new Date(this.clock()).toISOString(),
      generationAttempts: Number(current.generationAttempts || 0) + 1,
    }));

    const birth = order.birthData;
    const recipientName = birth.name;
    const partialFilename = `${order.id}.partial.pdf`;
    const finalFilename = `${order.id}.pdf`;
    const partialPath = path.join(this.store.outputDir, partialFilename);
    const finalPath = path.join(this.store.outputDir, finalFilename);

    try {
      if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath);
      await this.generator.generate({
        birth,
        coordinates: birth.coordinates,
        timezone: birth.timezone,
        targetPath: partialPath,
      });
      assertPdf(partialPath);
      try {
        fs.chmodSync(partialPath, 0o600);
      } catch (_error) {
        // Runtime directories are already mode 0700; some mounted filesystems
        // do not expose POSIX permission changes.
      }
      if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
      fs.renameSync(partialPath, finalPath);

      // This write is deliberately the first action after the PDF is safely
      // present. Names, locations, coordinates, dates, times, and timezone
      // data are all removed before email or marketing network calls begin.
      let markedReady = false;
      order = this.store.update(orderId, (current) => {
        // Retention cleanup may win while a long-running renderer is still
        // active. Never resurrect an order whose privacy window has closed.
        if (current.status !== 'generating' || !current.birthData) return null;
        const readyAt = this.clock();
        const scrubbed = {
          ...current,
          status: 'ready',
          readyAt: new Date(readyAt).toISOString(),
          birthDataScrubbedAt: new Date(readyAt).toISOString(),
          expiresAt: new Date(readyAt + this.config.retentionMs).toISOString(),
          pdfFilename: finalFilename,
        };
        delete scrubbed.birthData;
        delete scrubbed.failureCode;
        markedReady = true;
        return scrubbed;
      });
      if (!markedReady) {
        if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
        this.logger.warn('report_discarded_after_retention_expiry', { orderId });
        return;
      }
      this.logger.info('report_ready', { orderId });
      this.scheduleDelivery(orderId, recipientName);
    } catch (error) {
      if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath);
      this.store.update(orderId, (current) => ({
        ...current,
        status: 'failed',
        failedAt: new Date(this.clock()).toISOString(),
        failureCode: String(error.code || error.name || 'generation_failed').slice(0, 80),
      }));
      throw error;
    }
  }

  scheduleDelivery(orderId, recipientName = '') {
    const task = this.deliver(orderId, recipientName)
      .catch((error) => {
        this.logger.error('delivery_task_failed', { orderId, error });
      })
      .finally(() => this.deliveryTasks.delete(task));
    this.deliveryTasks.add(task);
    return task;
  }

  async deliver(orderId, recipientName = '') {
    let order = this.store.get(orderId);
    if (!order || order.status !== 'ready' || !order.pdfFilename) return;
    const pdfPath = path.join(this.store.outputDir, path.basename(order.pdfFilename));
    if (!fs.existsSync(pdfPath)) return;

    if (this.mailer.configured && order.delivery?.emailStatus !== 'sent') {
      try {
        await retryWithBackoff(() =>
          this.mailer.sendReport({
            to: order.delivery.email,
            lang: order.language,
            pdfPath,
            downloadUrl: this.downloadUrl(order),
          })
        );
        order = this.store.update(orderId, (current) => ({
          ...current,
          delivery: {
            ...current.delivery,
            emailStatus: 'sent',
            emailedAt: new Date(this.clock()).toISOString(),
          },
        }));
      } catch (error) {
        order = this.store.update(orderId, (current) => ({
          ...current,
          delivery: {
            ...current.delivery,
            emailStatus: 'failed',
          },
        }));
        this.logger.error('smtp_delivery_failed', {
          orderId,
          provider: 'smtp',
          error,
        });
      }
    }

    if (
      order.delivery?.marketingConsent &&
      this.mailerLite.configured &&
      order.delivery.mailerLiteStatus !== 'sent'
    ) {
      try {
        await retryWithBackoff(() =>
          this.mailerLite.addPaid({
            email: order.delivery.email,
            name: recipientName,
            lang: order.language,
          })
        );
        this.store.update(orderId, (current) => ({
          ...current,
          delivery: {
            ...current.delivery,
            mailerLiteStatus: 'sent',
            mailerLiteSentAt: new Date(this.clock()).toISOString(),
          },
        }));
      } catch (error) {
        this.store.update(orderId, (current) => ({
          ...current,
          delivery: {
            ...current.delivery,
            mailerLiteStatus: 'failed',
          },
        }));
        this.logger.error('mailerlite_delivery_failed', {
          orderId,
          provider: 'mailerlite',
          error,
        });
      }
    }
  }

  downloadUrl(order) {
    const token = this.downloadTokens.issue(order.id, order.expiresAt);
    const url = new URL(
      `/api/cosmic-report/download/${order.id}`,
      `${this.config.publicApiUrl}/`
    );
    url.searchParams.set('token', token);
    return url.toString();
  }

  async statusFromStripeSession(sessionId) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    const orderId = session?.metadata?.order_id;
    if (!validOrderId(orderId)) return null;
    if (
      session?.metadata?.type !== 'cosmic_report' ||
      session?.metadata?.service !== 'zodi_yuga_report_service_v1'
    ) {
      return null;
    }
    const existing = this.store.get(orderId);
    if (!existing || existing.stripeSessionId !== session.id) return null;
    if (session.payment_status === 'paid') {
      this.acceptPaidSession(session, 'status_fallback');
    }
    return this.store.get(orderId);
  }

  async recover() {
    this.store.cleanupExpired();
    for (const order of this.store.list()) {
      if (order.status === 'generating') {
        this.store.update(order.id, (current) => ({
          ...current,
          status: 'paid',
          recoveredAt: new Date(this.clock()).toISOString(),
        }));
        this.enqueue(order.id);
      } else if (order.status === 'paid') {
        this.enqueue(order.id);
      } else if (
        order.status === 'ready' &&
        (order.delivery?.emailStatus === 'pending' ||
          order.delivery?.emailStatus === 'failed' ||
          order.delivery?.mailerLiteStatus === 'pending' ||
          order.delivery?.mailerLiteStatus === 'failed')
      ) {
        this.scheduleDelivery(order.id);
      }
    }
  }

  async onIdle() {
    await this.queue.onIdle();
    while (this.deliveryTasks.size) {
      await Promise.allSettled([...this.deliveryTasks]);
    }
  }

  queueState() {
    return {
      active: this.queue.active,
      pending: this.queue.pending,
    };
  }
}

function assertPdf(filePath) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size < 5) throw new Error('generator_output_missing');
  const handle = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(5);
    fs.readSync(handle, header, 0, 5, 0);
    if (header.toString('ascii') !== '%PDF-') {
      throw new Error('generator_output_not_pdf');
    }
  } finally {
    fs.closeSync(handle);
  }
}

function locationConfirmationKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

async function retryWithBackoff(operation, delaysMs = [1000, 3000]) {
  let lastError;
  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < delaysMs.length) {
        await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
      }
    }
  }
  throw lastError;
}

module.exports = {
  ReportCoordinator,
  SerialQueue,
  assertPdf,
};
