export interface EmailResult {
  externalId: string;
}

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  clinicName?: string;
}

/** Send transactional email via Resend REST API (no SDK dep). */
export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');
  if (!from) throw new Error('RESEND_FROM_EMAIL is not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.body,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend error (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { id?: string };
  return { externalId: data.id ?? 'resend-unknown' };
}
