// Cloudflare Pages Function — POST /subscribe
// Subscribes an email to MailerLite group via the API
// Set MAILERLITE_API_KEY in Cloudflare Pages → Settings → Environment Variables

const GROUP_IDS = {
  en: '193186846127163324',
  es: '193183324450063960',
};
const ML_API_URL = 'https://connect.mailerlite.com/api/subscribers';

export async function onRequest(context) {
  const { request, env } = context;

  // Only accept POST
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = env.MAILERLITE_API_KEY;
  if (!apiKey) {
    return new Response('Server configuration error', { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return new Response('Invalid JSON', { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  const lang = body.lang === 'es' ? 'es' : 'en';
  const marketingConsent = body.marketingConsent === true;

  // Basic email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('Valid email required', { status: 400 });
  }
  if (!marketingConsent) {
    return new Response('Email consent required', { status: 400 });
  }

  try {
    const resp = await fetch(ML_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email,
        groups: [GROUP_IDS[lang]],
        fields: {
          source: 'zodiyuga-timeline-modal-consent-v1',
          language: lang,
        },
      }),
    });

    if (resp.ok || resp.status === 409) {
      // 409 = already exists — still count as success
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const errText = await resp.text();
    console.error('MailerLite error:', resp.status, errText);
    return new Response('Failed to subscribe', { status: 502 });
  } catch (err) {
    console.error('MailerLite fetch error:', err);
    return new Response('Service unavailable', { status: 502 });
  }
}
