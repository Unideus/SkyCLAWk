'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { DateTime } = require('luxon');
const tzLookup = require('tz-lookup');

const execFileAsync = promisify(execFile);
const REPORT_WORKSPACE_PREFIX = 'zodi-yuga-report-';
const REPORT_SUPPORTED_START_UTC_MS = Date.UTC(1940, 7, 8, 1, 26, 24);

class ServiceError extends Error {
  constructor(code, httpStatus = 500, options = {}) {
    super(code, options);
    this.name = 'ServiceError';
    this.code = code;
    this.httpStatus = httpStatus;
    if (options.resolvedLocation) this.resolvedLocation = options.resolvedLocation;
    if (options.timeZone) this.timeZone = options.timeZone;
  }
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref();
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

class Geocoder {
  constructor(config, fetchImpl = globalThis.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
    this.configured = Boolean(
      config.mapboxToken || config.allowNominatimFallback
    );
  }

  async resolve(location, lang = 'en') {
    if (this.config.mapboxToken) {
      try {
        const result = await this.resolveMapbox(location, lang);
        if (result) return result;
      } catch (error) {
        if (!this.config.allowNominatimFallback) {
          throw new ServiceError('geocoding_unavailable', 503, { cause: error });
        }
      }
    }
    if (this.config.allowNominatimFallback) {
      const result = await this.resolveNominatim(location, lang);
      if (result) return result;
    }
    throw new ServiceError('location_not_found', 422);
  }

  async resolveMapbox(location, lang) {
    const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
    url.searchParams.set('q', location);
    url.searchParams.set('access_token', this.config.mapboxToken);
    url.searchParams.set('limit', '1');
    url.searchParams.set('autocomplete', 'false');
    url.searchParams.set('language', lang === 'es' ? 'es' : 'en');
    if (this.config.mapboxCountryCodes) {
      url.searchParams.set('country', this.config.mapboxCountryCodes);
    }
    const response = await fetchWithTimeout(
      this.fetch,
      url,
      { headers: { Accept: 'application/json' } },
      this.config.timeoutMs
    );
    if (!response.ok) throw new ServiceError('mapbox_failed', 503);
    const data = await response.json();
    const feature = Array.isArray(data.features) ? data.features[0] : null;
    const coordinates = feature?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
    const [longitude, latitude] = coordinates.map(Number);
    if (!validCoordinates(latitude, longitude)) return null;
    const properties = feature?.properties || {};
    const label = cleanLocationLabel(
      properties.full_address ||
        (properties.name && properties.place_formatted
          ? `${properties.name}, ${properties.place_formatted}`
          : '') ||
        feature.place_name ||
        properties.name
    );
    if (!label) return null;
    return {
      latitude,
      longitude,
      provider: 'mapbox',
      label,
    };
  }

  async resolveNominatim(location, lang) {
    const url = new URL('/search', `${this.config.nominatimBaseUrl}/`);
    url.searchParams.set('q', location);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', lang === 'es' ? 'es' : 'en');
    const response = await fetchWithTimeout(
      this.fetch,
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': this.config.nominatimUserAgent,
        },
      },
      this.config.timeoutMs
    );
    if (!response.ok) throw new ServiceError('nominatim_failed', 503);
    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : null;
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);
    if (!validCoordinates(latitude, longitude)) return null;
    const label = cleanLocationLabel(result?.display_name);
    if (!label) return null;
    return {
      latitude,
      longitude,
      provider: 'nominatim',
      label,
    };
  }
}

function cleanLocationLabel(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function validCoordinates(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

class TimezoneResolver {
  constructor({ lookup = tzLookup, DateTimeClass = DateTime } = {}) {
    this.lookup = lookup;
    this.DateTime = DateTimeClass;
  }

  resolve(birth, coordinates) {
    let timeZone;
    try {
      timeZone = this.lookup(coordinates.latitude, coordinates.longitude);
    } catch (_error) {
      throw new ServiceError('timezone_not_found', 422);
    }

    const requested = {
      year: birth.year,
      month: birth.month,
      day: birth.day,
      hour: birth.hour,
      minute: birth.minute,
    };
    const local = this.DateTime.fromObject(requested, {
      zone: timeZone,
      setZone: true,
    });
    if (
      !local.isValid ||
      local.year !== birth.year ||
      local.month !== birth.month ||
      local.day !== birth.day ||
      local.hour !== birth.hour ||
      local.minute !== birth.minute
    ) {
      throw new ServiceError('invalid_local_time', 422);
    }

    const candidates =
      typeof local.getPossibleOffsets === 'function'
        ? local.getPossibleOffsets()
        : [local];
    const distinct = new Map(candidates.map((candidate) => [candidate.offset, candidate]));
    let selected = local;
    if (distinct.size > 1) {
      if (birth.utcOffsetMinutes === null) {
        const error = new ServiceError('ambiguous_local_time', 422);
        error.allowedUtcOffsets = [...distinct.keys()].sort((a, b) => a - b);
        throw error;
      }
      selected = distinct.get(birth.utcOffsetMinutes);
      if (!selected) throw new ServiceError('invalid_utc_offset_choice', 422);
    } else if (
      birth.utcOffsetMinutes !== null &&
      birth.utcOffsetMinutes !== local.offset
    ) {
      throw new ServiceError('invalid_utc_offset_choice', 422);
    }

    return {
      timeZone,
      timeZoneLabel: selected.offsetNameShort || timeZone,
      utcOffsetHoursForEngine: -selected.offset / 60,
      utcTimestampMs: selected.toUTC().toMillis(),
    };
  }
}

class PythonReportGenerator {
  constructor(config) {
    this.config = config;
    this.configured =
      fs.existsSync(config.scriptPath) && fs.existsSync(config.ephemerisPath);
    this.sweepStaleWorkspaces();
  }

  sweepStaleWorkspaces() {
    const oldestAllowed =
      Date.now() - Math.max(Number(this.config.timeoutMs || 0) * 2, 60 * 60 * 1000);
    try {
      for (const entry of fs.readdirSync(os.tmpdir(), { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.startsWith(REPORT_WORKSPACE_PREFIX)) {
          continue;
        }
        const workspace = path.join(os.tmpdir(), entry.name);
        if (fs.statSync(workspace).mtimeMs < oldestAllowed) {
          fs.rmSync(workspace, { recursive: true, force: true });
        }
      }
    } catch (_error) {
      // A render still gets its own private workspace. Startup cleanup is
      // best-effort because the service may run on a restricted filesystem.
    }
  }

  async generate({ birth, coordinates, timezone, targetPath }) {
    const workspace = fs.mkdtempSync(
      path.join(os.tmpdir(), REPORT_WORKSPACE_PREFIX)
    );
    try {
      fs.chmodSync(workspace, 0o700);
    } catch (_error) {
      // The parent temp directory still provides the platform's isolation.
    }
    const args = [
      this.config.scriptPath,
      '--year',
      String(birth.year),
      '--month',
      String(birth.month),
      '--day',
      String(birth.day),
      '--hour',
      String(birth.hour),
      '--min',
      String(birth.minute),
      '--utc-offset',
      String(timezone.utcOffsetHoursForEngine),
      '--tz-label',
      timezone.timeZoneLabel,
      '--lat',
      String(coordinates.latitude),
      '--lon',
      String(coordinates.longitude),
      '--location',
      birth.location,
      '--name',
      birth.name,
      '--lang',
      birth.lang,
      '--output',
      targetPath,
      '--work-dir',
      workspace,
    ];

    try {
      await execFileAsync(this.config.pythonBin, args, {
        cwd: path.dirname(this.config.scriptPath),
        timeout: this.config.timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        env: {
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
          LANG: process.env.LANG || 'C.UTF-8',
          LC_ALL: process.env.LC_ALL || '',
          HOME: process.env.HOME || '',
          XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || '',
          FONTCONFIG_PATH: process.env.FONTCONFIG_PATH || '',
          LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH || '',
          SWE_EPHE_PATH: this.config.ephemerisPath,
          TMPDIR: workspace,
        },
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }
}

class MailerLiteClient {
  constructor(config, fetchImpl = globalThis.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
    this.configured = Boolean(
      config.enabled &&
        config.apiKey &&
        config.paidGroups.en &&
        config.paidGroups.es
    );
  }

  async addPaid({ email, name, lang }) {
    if (!this.configured) return { skipped: true };
    const groupId = this.config.paidGroups[lang === 'es' ? 'es' : 'en'];
    const response = await fetchWithTimeout(
      this.fetch,
      'https://connect.mailerlite.com/api/subscribers',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          fields: { name: name || '' },
          groups: [groupId],
        }),
      },
      this.config.timeoutMs
    );
    if (!response.ok) throw new ServiceError('mailerlite_failed', 502);
    return { skipped: false, groupId };
  }
}

class SmtpMailer {
  constructor(config, nodemailer) {
    this.config = config;
    this.configured = Boolean(
      config.enabled &&
        config.host &&
        config.user &&
        config.pass &&
        config.fromEmail &&
        config.replyTo
    );
    this.transporter = this.configured
      ? nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: { user: config.user, pass: config.pass },
          connectionTimeout: config.timeoutMs,
          greetingTimeout: config.timeoutMs,
          socketTimeout: config.timeoutMs,
        })
      : null;
  }

  async sendReport({ to, lang, pdfPath, downloadUrl }) {
    if (!this.configured) return { skipped: true };
    const spanish = lang === 'es';
    await this.transporter.sendMail({
      from: {
        name: this.config.fromName,
        address: this.config.fromEmail,
      },
      replyTo: this.config.replyTo,
      to,
      subject: spanish
        ? 'Tu Informe de Historia Cósmica está listo'
        : 'Your Cosmic History Report is ready',
      text: spanish
        ? [
            'Hola,',
            '',
            'Tu Informe de Historia Cósmica de Zodi Yuga está listo.',
            '',
            `Descarga segura (disponible durante 7 días): ${downloadUrl}`,
            '',
            'También adjuntamos una copia en PDF.',
            '',
            '— Zodi Yuga Reports',
          ].join('\n')
        : [
            'Hello,',
            '',
            'Your Zodi Yuga Cosmic History Report is ready.',
            '',
            `Secure download (available for 7 days): ${downloadUrl}`,
            '',
            'A PDF copy is also attached.',
            '',
            '— Zodi Yuga Reports',
          ].join('\n'),
      attachments: [
        {
          filename:
            lang === 'es'
              ? 'informe-de-historia-cosmica.pdf'
              : 'cosmic-history-report.pdf',
          path: pdfPath,
        },
      ],
    });
    return { skipped: false };
  }
}

module.exports = {
  Geocoder,
  MailerLiteClient,
  PythonReportGenerator,
  ServiceError,
  SmtpMailer,
  TimezoneResolver,
  REPORT_SUPPORTED_START_UTC_MS,
  cleanLocationLabel,
  validCoordinates,
};
