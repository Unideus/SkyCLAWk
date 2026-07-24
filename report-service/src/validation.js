'use strict';

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
];

function normalizedString(value, maxLength) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function integerValue(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function isCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeAttribution(input) {
  const source = input && typeof input === 'object' ? input : {};
  const attribution = {};
  for (const key of UTM_KEYS) {
    const value = normalizedString(source[key], 120);
    if (value) attribution[key] = value;
  }
  return attribution;
}

function stripeAttributionMetadata(attribution) {
  return Object.fromEntries(
    Object.entries(normalizeAttribution(attribution)).map(([key, value]) => [key, value])
  );
}

function validateCheckoutInput(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['invalid_body'] };
  }

  const errors = [];
  const name = normalizedString(input.name, 120);
  const email = normalizedString(input.email, 254).toLowerCase();
  const location = normalizedString(input.location, 200);
  const confirmedLocation = normalizedString(input.confirmedLocation, 300);
  const lang = input.lang === 'es' ? 'es' : input.lang === 'en' || !input.lang ? 'en' : null;
  const year = integerValue(input.year);
  const month = integerValue(input.month);
  const day = integerValue(input.day);
  const hour = integerValue(input.hour);
  const minute = integerValue(input.min ?? input.minute);
  const utcOffsetMinutes =
    input.utcOffsetMinutes === undefined || input.utcOffsetMinutes === null
      ? null
      : integerValue(input.utcOffsetMinutes);
  const marketingConsent = input.marketingConsent === true;
  const marketingConsentVersion = normalizedString(
    input.marketingConsentVersion ?? input.consentVersion,
    64
  );
  const marketingConsentSource = normalizedString(
    input.marketingConsentSource || (marketingConsent ? 'cosmic-report-checkout' : ''),
    64
  );

  if (name.length < 1) errors.push('name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('email');
  if (location.length < 2) errors.push('location');
  if (!lang) errors.push('lang');

  const currentYear = now.getUTCFullYear();
  if (year === null || year < 1940 || year > currentYear) errors.push('year');
  if (month === null || month < 1 || month > 12) errors.push('month');
  if (day === null || day < 1 || day > 31) errors.push('day');
  if (
    year !== null &&
    month !== null &&
    day !== null &&
    !isCalendarDate(year, month, day)
  ) {
    errors.push('date');
  } else if (
    year !== null &&
    month !== null &&
    day !== null &&
    Date.UTC(year, month - 1, day) >
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ) {
    errors.push('date');
  }
  if (hour === null || hour < 0 || hour > 23) errors.push('hour');
  if (minute === null || minute < 0 || minute > 59) errors.push('min');
  if (
    utcOffsetMinutes !== null &&
    (utcOffsetMinutes < -14 * 60 || utcOffsetMinutes > 14 * 60)
  ) {
    errors.push('utcOffsetMinutes');
  }
  if (
    marketingConsent &&
    (!marketingConsentVersion || !marketingConsentSource)
  ) {
    errors.push('marketingConsentRecord');
  }

  if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  return {
    ok: true,
    value: {
      name,
      email,
      location,
      confirmedLocation,
      lang,
      year,
      month,
      day,
      hour,
      minute,
      utcOffsetMinutes,
      marketingConsent,
      marketingConsentVersion: marketingConsent ? marketingConsentVersion : '',
      marketingConsentSource: marketingConsent ? marketingConsentSource : '',
      attribution: normalizeAttribution(input.attribution),
    },
  };
}

function validStripeSessionId(value) {
  return /^cs_(?:test|live)_[A-Za-z0-9_]{6,240}$/.test(String(value || ''));
}

function validOrderId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

module.exports = {
  UTM_KEYS,
  normalizeAttribution,
  stripeAttributionMetadata,
  validOrderId,
  validStripeSessionId,
  validateCheckoutInput,
};
