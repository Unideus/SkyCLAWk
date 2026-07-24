'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const { createSystem } = require('./app');
const { assertProductionConfig, loadConfig } = require('./config');
const {
  Geocoder,
  MailerLiteClient,
  PythonReportGenerator,
  SmtpMailer,
  TimezoneResolver,
} = require('./integrations');
const { createSafeLogger } = require('./logger');

async function main() {
  const config = loadConfig();
  assertProductionConfig(config);
  const logger = createSafeLogger(console, config.logLevel);
  const stripe = new Stripe(config.stripe.secretKey);
  const system = createSystem({
    config,
    stripe,
    geocoder: new Geocoder(config.geocoding),
    timezoneResolver: new TimezoneResolver(),
    generator: new PythonReportGenerator(config.report),
    mailer: new SmtpMailer(config.smtp, nodemailer),
    mailerLite: new MailerLiteClient(config.mailerLite),
    logger,
  });

  await system.start();
  const server = system.app.listen(config.port, '127.0.0.1', () => {
    logger.info('service_started', { status: 'ready' });
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('service_stopping');
    server.close(async () => {
      await system.stop();
      process.exitCode = 0;
    });
    setTimeout(() => {
      process.exitCode = 1;
      server.closeAllConnections?.();
    }, 30000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  const logger = createSafeLogger(console);
  logger.error('service_start_failed', { error });
  process.exitCode = 1;
});
