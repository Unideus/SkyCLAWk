'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SERVICE_ROOT = path.resolve(__dirname, '..');
const SKYCLAWK_ROOT = path.resolve(SERVICE_ROOT, '..');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function asBoolean(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function asInteger(value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid numeric configuration value`);
  }
  return parsed;
}

function asUrl(value, fallback) {
  const raw = String(value || fallback || '').trim().replace(/\/+$/, '');
  const parsed = new URL(raw);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Configured URL must use HTTP or HTTPS');
  }
  return parsed.toString().replace(/\/+$/, '');
}

function parseOrigins(value) {
  const configured = String(
    value || 'https://zodiyuga.com,https://www.zodiyuga.com'
  )
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (configured.length === 0) throw new Error('At least one CORS origin is required');

  return configured.map((origin) => {
    const parsed = new URL(origin);
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('CORS origins cannot contain paths, queries, or fragments');
    }
    return parsed.origin;
  });
}

function loadConfig(env = process.env) {
  const nodeEnv = String(env.NODE_ENV || 'development');
  const publicApiUrl = asUrl(env.PUBLIC_API_URL, 'https://reports.zodiyuga.com');
  const landingBaseUrl = asUrl(env.LANDING_BASE_URL, 'https://zodiyuga.com/cosmic-report');

  return {
    nodeEnv,
    port: asInteger(env.PORT, 3100, { min: 1, max: 65535 }),
    trustProxy: asInteger(env.TRUST_PROXY, 1, { min: 0, max: 10 }),
    logLevel: String(env.LOG_LEVEL || 'info'),
    salesEnabled: asBoolean(env.SALES_ENABLED, false),
    publicApiUrl,
    landingBaseUrl,
    allowedOrigins: parseOrigins(env.CORS_ALLOWED_ORIGINS),
    retentionMs: SEVEN_DAYS_MS,
    cleanupIntervalMs: 60 * 60 * 1000,
    stripe: {
      secretKey: String(env.STRIPE_SECRET_KEY || ''),
      webhookSecret: String(env.STRIPE_WEBHOOK_SECRET || ''),
      priceId: String(env.COSMIC_REPORT_PRICE_ID || ''),
    },
    downloadTokenSecret: String(env.DOWNLOAD_TOKEN_SECRET || ''),
    report: {
      scriptPath: path.resolve(
        env.COSMIC_REPORT_SCRIPT ||
          path.join(SKYCLAWK_ROOT, 'report-engine', 'scripts', 'generate_full_report.py')
      ),
      pythonBin: String(env.COSMIC_PYTHON_BIN || 'python3'),
      ephemerisPath: path.resolve(
        env.COSMIC_EPHE_PATH || path.join(SKYCLAWK_ROOT, 'public', 'ephe')
      ),
      timeoutMs: asInteger(env.GENERATOR_TIMEOUT_MS, 15 * 60 * 1000, {
        min: 30 * 1000,
        max: 60 * 60 * 1000,
      }),
    },
    storage: {
      ordersDir: path.resolve(env.ORDERS_DIR || path.join(SERVICE_ROOT, 'runtime', 'orders')),
      outputDir: path.resolve(
        env.REPORT_OUTPUT_DIR || path.join(SERVICE_ROOT, 'runtime', 'reports')
      ),
    },
    geocoding: {
      mapboxToken: String(env.MAPBOX_ACCESS_TOKEN || ''),
      mapboxCountryCodes: String(env.MAPBOX_COUNTRY_CODES || ''),
      allowNominatimFallback: asBoolean(env.ALLOW_NOMINATIM_FALLBACK, false),
      nominatimBaseUrl: asUrl(
        env.NOMINATIM_BASE_URL,
        'https://nominatim.openstreetmap.org'
      ),
      nominatimUserAgent: String(
        env.NOMINATIM_USER_AGENT ||
          'ZodiYugaReportService/1.0 (support@zodiyuga.com)'
      ),
      timeoutMs: asInteger(env.GEOCODE_TIMEOUT_MS, 10000, {
        min: 1000,
        max: 30000,
      }),
    },
    smtp: {
      enabled: asBoolean(env.SMTP_DELIVERY_ENABLED, false),
      host: String(env.SMTP_HOST || ''),
      port: asInteger(env.SMTP_PORT, 587, { min: 1, max: 65535 }),
      secure: asBoolean(env.SMTP_SECURE, false),
      user: String(env.SMTP_USER || ''),
      pass: String(env.SMTP_PASS || ''),
      fromName: String(env.SMTP_FROM_NAME || 'Zodi Yuga Reports'),
      fromEmail: String(env.SMTP_FROM_EMAIL || ''),
      replyTo: String(env.SMTP_REPLY_TO || ''),
      timeoutMs: asInteger(env.SMTP_TIMEOUT_MS, 15000, {
        min: 1000,
        max: 60000,
      }),
    },
    mailerLite: {
      enabled: asBoolean(env.MAILERLITE_ENABLED, false),
      apiKey: String(env.MAILERLITE_API_KEY || ''),
      paidGroups: {
        en: String(env.MAILERLITE_PAID_EN_GROUP_ID || ''),
        es: String(env.MAILERLITE_PAID_ES_GROUP_ID || ''),
      },
      timeoutMs: asInteger(env.MAILERLITE_TIMEOUT_MS, 10000, {
        min: 1000,
        max: 30000,
      }),
    },
  };
}

function assertProductionConfig(config) {
  const failures = [];
  const required = [
    ['STRIPE_SECRET_KEY', config.stripe.secretKey],
    ['STRIPE_WEBHOOK_SECRET', config.stripe.webhookSecret],
    ['COSMIC_REPORT_PRICE_ID', config.stripe.priceId],
    ['DOWNLOAD_TOKEN_SECRET', config.downloadTokenSecret],
  ];

  for (const [name, value] of required) {
    if (!value) failures.push(`${name} is required`);
  }
  if (config.downloadTokenSecret.length < 32) {
    failures.push('DOWNLOAD_TOKEN_SECRET must contain at least 32 characters');
  }
  if (!config.geocoding.mapboxToken && !config.geocoding.allowNominatimFallback) {
    failures.push('MAPBOX_ACCESS_TOKEN is required unless Nominatim fallback is enabled');
  }
  if (!fs.existsSync(config.report.scriptPath)) {
    failures.push('COSMIC_REPORT_SCRIPT does not exist');
  }
  if (!fs.existsSync(config.report.ephemerisPath)) {
    failures.push('COSMIC_EPHE_PATH does not exist');
  }
  if (config.nodeEnv === 'production') {
    if (!config.publicApiUrl.startsWith('https://')) {
      failures.push('PUBLIC_API_URL must use HTTPS in production');
    }
    if (!config.landingBaseUrl.startsWith('https://')) {
      failures.push('LANDING_BASE_URL must use HTTPS in production');
    }
    if (config.allowedOrigins.some((origin) => !origin.startsWith('https://'))) {
      failures.push('CORS origins must use HTTPS in production');
    }
  }
  if (config.smtp.enabled) {
    for (const [name, value] of [
      ['SMTP_HOST', config.smtp.host],
      ['SMTP_USER', config.smtp.user],
      ['SMTP_PASS', config.smtp.pass],
      ['SMTP_FROM_EMAIL', config.smtp.fromEmail],
      ['SMTP_REPLY_TO', config.smtp.replyTo],
    ]) {
      if (!value) failures.push(`${name} is required when SMTP delivery is enabled`);
    }
  }
  if (config.salesEnabled && !config.smtp.enabled) {
    failures.push('SMTP_DELIVERY_ENABLED must be true before SALES_ENABLED can be true');
  }
  if (config.mailerLite.enabled) {
    for (const [name, value] of [
      ['MAILERLITE_API_KEY', config.mailerLite.apiKey],
      ['MAILERLITE_PAID_EN_GROUP_ID', config.mailerLite.paidGroups.en],
      ['MAILERLITE_PAID_ES_GROUP_ID', config.mailerLite.paidGroups.es],
    ]) {
      if (!value) failures.push(`${name} is required when MailerLite is enabled`);
    }
  }

  if (failures.length) {
    throw new Error(`Report service configuration is incomplete:\n- ${failures.join('\n- ')}`);
  }
}

module.exports = {
  SEVEN_DAYS_MS,
  assertProductionConfig,
  loadConfig,
};
