const GRAPH_API = 'https://graph.facebook.com/v21.0';

function getPageToken(): string {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('META_PAGE_ACCESS_TOKEN is not set');
  return token;
}

export interface SendResult { externalId: string; }

async function post(body: Record<string, unknown>): Promise<SendResult> {
  const res = await fetch(GRAPH_API + '/me/messages?access_token=' + getPageToken(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); throw new Error('Meta send failed: ' + res.status + ' ' + t); }
  const data = await res.json() as { message_id?: string };
  return { externalId: data.message_id ?? '' };
}

export async function sendTextMessage(recipientId: string, text: string): Promise<SendResult> {
  return post({ recipient: { id: recipientId }, messaging_type: 'RESPONSE', message: { text } });
}

export async function sendQuickReplies(
  recipientId: string, text: string, options: Array<{ title: string; payload: string }>,
): Promise<SendResult> {
  return post({
    recipient: { id: recipientId },
    messaging_type: 'RESPONSE',
    message: { text, quick_replies: options.slice(0, 13).map(o => ({ content_type: 'text', title: o.title.slice(0, 20), payload: o.payload })) },
  });
}
