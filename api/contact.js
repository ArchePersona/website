const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function jsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function sanitize(value) {
  return String(value || '').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || 'ArchePersona <onboarding@resend.dev>';

  if (!apiKey || !toEmail) {
    return jsonResponse(res, 500, { error: 'Contact form is not configured' });
  }

  const name = sanitize(req.body?.name);
  const email = sanitize(req.body?.email);
  const message = sanitize(req.body?.message);
  const company = sanitize(req.body?.company);

  if (company) {
    return jsonResponse(res, 200, { ok: true });
  }

  if (!name || !email || !message) {
    return jsonResponse(res, 400, { error: 'Missing required fields' });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return jsonResponse(res, 400, { error: 'Invalid email' });
  }

  const text = [
    'New ArchePersona contact form message',
    '',
    `Name: ${name}`,
    `Email: ${email}`,
    '',
    'Message:',
    message,
  ].join('\n');

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: `ArchePersona contact: ${name}`,
      text,
    }),
  });

  if (!response.ok) {
    return jsonResponse(res, 502, { error: 'Email provider failed' });
  }

  return jsonResponse(res, 200, { ok: true });
}
