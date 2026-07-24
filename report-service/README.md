# Zodi Yuga Cosmic Report Service

Standalone payment and fulfillment backend for the Zodi Yuga Cosmic History
Report. It deliberately has no permaculture routes, garden data, static landing
pages, or shared application state.

The customer-facing API host should be `https://reports.zodiyuga.com`. The
canonical sales page remains `https://zodiyuga.com/cosmic-report`.

## Fulfillment contract

1. `POST /api/cosmic-report/checkout` validates the complete calendar date,
   birth time, location, language, and consent record.
2. Before creating Stripe Checkout, the service geocodes the location and
   verifies its IANA timezone and local-time/DST validity. It returns the
   provider's canonical place label and requires the customer to affirm that
   exact place before payment. A customer cannot pay for a report the service
   already knows it cannot generate, or for a silently guessed city.
3. Stripe receives a fixed server-configured Price ID. No amount or Price ID is
   accepted from the browser. Only the order ID, language, consent audit fields,
   and bounded UTM fields enter metadata; birth details do not.
4. A signed Stripe webhook changes the durable order to `paid`. The status
   route independently retrieves the Checkout Session and can recover a missed
   webhook when Stripe says it is paid.
5. A one-at-a-time durable queue runs the sibling
   `../report-engine/scripts/generate_full_report.py` with an argument array and
   no shell.
6. As soon as a valid PDF is present, the order is marked `ready` and its name,
   birth location, coordinates, calendar date, local time, and timezone are
   removed from disk before email or MailerLite calls start.
7. Transactional SMTP delivery and an HMAC-signed download link are independent
   of marketing consent. MailerLite paid EN/ES routing runs only when the
   customer explicitly supplied `marketingConsent: true` with a consent version
   and source.
8. Orders and PDFs expire after seven days. Cleanup runs at startup and hourly.
   Interrupted `paid` or `generating` jobs resume only while still inside that
   ceiling. At the ceiling, unfulfilled birth data is scrubbed and the order
   becomes `expired_unfulfilled` for receipt-based support resolution.
9. Every Python run receives a private `0700` workspace controlled by Node.
   The workspace is removed after success, failure, or timeout; a startup sweep
   removes stale crash leftovers.
10. `SALES_ENABLED=false` is the default. Checkout stays closed until the real
    renderer, Stripe webhook, transactional sender, and EN/ES delivery path have
    all passed production verification.

## API

### Health

```http
GET /healthz
```

The response contains queue depth and boolean configuration state, never keys or
customer data.

### Checkout

```http
POST /api/cosmic-report/checkout
Origin: https://zodiyuga.com
Content-Type: application/json

{
  "name": "Customer name",
  "email": "customer@example.com",
  "location": "Jacksonville, Florida",
  "confirmedLocation": "Jacksonville, Florida, United States",
  "year": 1982,
  "month": 5,
  "day": 2,
  "hour": 2,
  "min": 16,
  "lang": "en",
  "marketingConsent": true,
  "marketingConsentVersion": "cosmic-report-consent-2026-07",
  "marketingConsentSource": "cosmic-report-checkout",
  "attribution": {
    "utm_source": "youtube",
    "utm_medium": "video",
    "utm_campaign": "sky-remembers"
  }
}
```

Omit the two consent audit fields when `marketingConsent` is false. If a
location has not yet been confirmed, checkout returns `409`:

```json
{
  "error": "location_confirmation_required",
  "resolvedLocation": "Jacksonville, Florida, United States",
  "timeZone": "America/New_York"
}
```

Show that exact label and timezone to the customer. Resubmit it unchanged as
`confirmedLocation` only after the customer affirmatively confirms it. Changing
the typed location must clear the confirmation.

If a fall-back DST time is ambiguous, checkout returns:

```json
{
  "error": "ambiguous_local_time",
  "allowedUtcOffsets": [-300, -240]
}
```

The UI should ask the customer which offset applies, then resubmit with
`utcOffsetMinutes` set to one of those values. Invalid or nonexistent local
times return `invalid_local_time`; an unresolved place returns
`location_not_found`.

### Stripe webhook

```http
POST /api/stripe-webhook
Stripe-Signature: ...
```

Subscribe the endpoint to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

The route must receive the raw request body. It ignores Checkout Sessions that
do not carry both `type=cosmic_report` and
`service=zodi_yuga_report_service_v1`.

### Status and download

```http
GET /api/cosmic-report/order-status?session_id=cs_...
GET /api/cosmic-report/download/:orderId?token=...
```

Status exposes only fulfillment state, expiry, transactional-email state, and a
short-lived capability URL when ready. Download filenames never contain the
customer's name.

## Local verification

Node 20 or newer is required.

```bash
npm ci
npm test
npm run check
npm audit
```

Tests mock Stripe, geocoding, timezone resolution, the Python generator, SMTP,
and MailerLite. They cover checkout, raw signed webhook handling, paid-session
fallback, serial generation, birth-data scrubbing, paid EN/ES routing, no-consent
behavior, canonical-place confirmation, strict retention behavior, and tokenized
download. A release also requires a real renderer smoke test; the mocks do not
prove that WeasyPrint, fonts, Swiss Ephemeris, or OS libraries work.

## VPS installation

Production uses a dedicated `zodireports` system account. Release code and the
Python environment are root-owned and read-only to the service; mutable state
lives separately under `/var/lib`. The active release is selected by the
`/opt/zodi-yuga/current` symlink.

```bash
sudo useradd --system \
  --home-dir /var/lib/zodi-yuga-report-service \
  --shell /usr/sbin/nologin \
  zodireports
sudo install -d -o root -g root -m 755 /opt/zodi-yuga/releases
sudo install -d -o zodireports -g zodireports -m 700 \
  /var/lib/zodi-yuga-report-service \
  /var/lib/zodi-yuga-report-service/orders \
  /var/lib/zodi-yuga-report-service/reports \
  /var/lib/zodi-yuga-report-service/tmp
sudo install -d -o root -g zodireports -m 750 \
  /etc/zodi-yuga-report-service
```

Copy a complete SkyCLAWk tree into a root-owned versioned directory such as
`/opt/zodi-yuga/releases/20260723-2`, then install its dependencies:

```bash
cd /opt/zodi-yuga/releases/20260723-2/report-service
sudo npm ci --omit=dev
sudo python3 -m venv /opt/zodi-yuga/venv
sudo /opt/zodi-yuga/venv/bin/pip install pyswisseph WeasyPrint CairoSVG PyMuPDF
sudo ln -sfn /opt/zodi-yuga/releases/20260723-2 /opt/zodi-yuga/current
sudo chown -h root:root /opt/zodi-yuga/current
```

WeasyPrint and CairoSVG also need their distribution packages (Cairo, Pango,
GDK-PixBuf, and fonts). Install the packages appropriate to the VPS operating
system and run one non-customer report as `zodireports` before accepting
payment.

Generate the download signing secret on the VPS:

```bash
openssl rand -base64 48
```

Put the result in `DOWNLOAD_TOKEN_SECRET`. Do not paste keys into
the systemd unit, shell history, Git, tickets, or logs. Build
`/etc/zodi-yuga-report-service/.env` from `.env.example`, then set ownership and
permissions so root can administer it and only the service group can read it:

```bash
sudo chown root:zodireports /etc/zodi-yuga-report-service/.env
sudo chmod 640 /etc/zodi-yuga-report-service/.env
```

Do not include the runtime directories in ordinary backups: pre-generation
order files temporarily contain birth details. Keep the release directory,
virtual environment, and `current` symlink root-owned; the service account needs
read access, not write access, to application code.

### Email readiness gate

`SMTP_FROM_EMAIL` and `SMTP_REPLY_TO` are intentionally required when
`SMTP_DELIVERY_ENABLED=true`; the code does not silently fall back to a Sign &
Soil identity.

Before enabling Zodi Yuga delivery:

1. provision the `reports@zodiyuga.com` mailbox or authenticated sending
   identity;
2. publish and verify SPF and DKIM;
3. publish DMARC, initially with monitoring if necessary;
4. verify Reply-To delivery;
5. send English and Spanish test reports and inspect authentication headers.

Keep `SMTP_DELIVERY_ENABLED=false` until those checks pass. Customers can still
download already-paid ready reports from the thank-you page. Keep
`SALES_ENABLED=false` until transactional delivery passes, and never advertise
a `reports@zodiyuga.com` sender before it is provisioned.

MailerLite has the same explicit gate. Keep `MAILERLITE_ENABLED=false` until its
API key and the current paid English and Spanish group IDs are present. Group
IDs are environment configuration so stale IDs are not frozen in application
code.

## systemd

Run exactly one process. The queue and atomic JSON order store are durable, but
they are intentionally single-writer and the PDF renderer is intentionally
serial.

Install `/etc/systemd/system/zodi-yuga-report-service.service`:

```ini
[Unit]
Description=Zodi Yuga Cosmic Report Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=zodireports
Group=zodireports
WorkingDirectory=/opt/zodi-yuga/current/report-service
EnvironmentFile=/etc/zodi-yuga-report-service/.env
Environment=HOME=/var/lib/zodi-yuga-report-service
Environment=TMPDIR=/var/lib/zodi-yuga-report-service/tmp
ExecStart=/usr/bin/node /opt/zodi-yuga/current/report-service/src/server.js
Restart=on-failure
RestartSec=3
TimeoutStopSec=16min
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
ReadWritePaths=/var/lib/zodi-yuga-report-service
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6

[Install]
WantedBy=multi-user.target
```

Load and verify it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now zodi-yuga-report-service.service
sudo systemctl status zodi-yuga-report-service.service
curl -fsS http://127.0.0.1:3100/healthz
```

Do not add another unit instance or process manager. A later move to multiple
workers requires a real shared queue and transactional database. Review logs
with `journalctl -u zodi-yuga-report-service.service`; do not configure logs to
include request query strings.

## Nginx

Create DNS and a certificate for `reports.zodiyuga.com` before switching the
landing page. The service binds only to loopback; Nginx owns public TLS.

Define a log format in the Nginx `http` block that excludes query strings, so
download capability tokens are not written to access logs:

```nginx
log_format report_no_query '$remote_addr - $remote_user [$time_local] '
                           '"$request_method $uri $server_protocol" $status $body_bytes_sent '
                           '"$http_user_agent"';
limit_req_zone $binary_remote_addr zone=report_checkout:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=report_status:10m rate=30r/m;
```

Example server:

```nginx
server {
    listen 443 ssl http2;
    server_name reports.zodiyuga.com;

    access_log /var/log/nginx/reports.zodiyuga.com.access.log report_no_query;
    error_log  /var/log/nginx/reports.zodiyuga.com.error.log warn;

    client_max_body_size 256k;

    location = /api/cosmic-report/checkout {
        limit_req zone=report_checkout burst=5 nodelay;
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

    location = /api/cosmic-report/order-status {
        limit_req zone=report_status burst=10 nodelay;
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
    }
}
```

Do not expose a direct generation endpoint. Nginx should never serve the runtime
directories as static files.

## Cutover from the permaculture VPS build

Use a staged migration; do not move old download URLs prematurely.

1. Deploy this directory and its Python environment without changing DNS,
   Stripe, or the landing page.
2. Start the systemd unit as `zodireports`, validate `/healthz`, run the local
   mocked test suite, and generate one non-customer PDF with the configured
   Python executable.
3. Create `reports.zodiyuga.com`, issue TLS, and test CORS from a staging copy of
   the Zodi Yuga landing page.
4. Add the new Stripe webhook endpoint and its new signing secret. Keep the old
   webhook active during the transition. This service's metadata filter prevents
   it from claiming old or unrelated products.
5. Update the Zodi Yuga landing page API base to
   `https://reports.zodiyuga.com` while preserving these route paths:
   `/api/cosmic-report/checkout`, `/order-status`, and `/download/:id`.
6. Add the explicit marketing checkbox record fields described above and handle
   the DST ambiguity response before switching real traffic.
7. Complete one real-price English purchase and one real-price Spanish purchase.
   Verify Stripe payment, serial generation, PDF accuracy, status fallback,
   secure download, seven-day expiry, transactional delivery, and the correct
   consented MailerLite group.
8. Keep `SALES_ENABLED=false` through preflight work; enable it only after the
   production gates above pass.
9. Only after the new route is proven should the cosmic routes and generator be
   removed from the permaculture Node process.

Existing links such as
`https://signandsoil.online/api/cosmic-report/download/...` use old order files
and a different token scheme. Leave those legacy download/status paths pointed
at the old process for at least seven days after the last old order. The same
applies to legacy `cosmic.signandsoil.online/api/*` traffic. Do not proxy those
paths to this service until every old order has expired, unless the associated
order JSON, PDF, and token validation are deliberately migrated together.

After the overlap window:

- remove Cosmic Report generation from the permaculture process;
- leave Sign & Soil serving only the practical garden/permaculture pipeline;
- optionally keep a legacy API proxy for non-download routes, but make all new
  customer links use the Zodi-owned host;
- confirm that no Stripe webhook target can fulfill the same new order twice;
- archive operational migration notes without retaining birth data or tokens.

## Operational checks

- Alert if `/healthz` fails, queue depth grows, or the systemd unit restart
  count changes.
- Check free disk space: WeasyPrint temporarily creates more than one PDF.
- Inspect only event names and order IDs in application logs. Names, emails,
  locations, birth data, Stripe URLs, and download tokens must not be logged.
- Use Stripe receipt identifiers—not birth details—when a customer contacts
  support.
- Run `npm audit` and the mocked suite before each dependency release.
- Keep the report engine and its ephemeris files versioned with the service
  deployment so a retry uses the same interpretation code.
