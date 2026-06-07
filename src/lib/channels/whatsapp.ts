import { normalizeForWhatsApp } from '@/lib/phone';

function getPhoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set');
  return id;
}

function getHeaders(): Record<string, string> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not set');
  return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
}

function getApiUrl(): string {
  return 'https://graph.facebook.com/v21.0/' + getPhoneNumberId() + '/messages';
}

export interface TemplateButton { type: 'quick_reply'; text: string; payload: string; }
export interface SendResult { externalId: string; }

export async function sendTemplateMessage(
  to: string, templateName: string, languageCode: string,
  bodyParams: string[], buttons?: TemplateButton[],
): Promise<SendResult> {
  const components: Record<string, unknown>[] = [];
  if (bodyParams.length > 0)
    components.push({ type: 'body', parameters: bodyParams.map(text => ({ type: 'text', text })) });
  if (buttons)
    buttons.forEach((btn, i) => components.push({ type: 'button', sub_type: 'quick_reply', index: i.toString(), parameters: [{ type: 'payload', payload: btn.payload }] }));
  const body = { messaging_product: 'whatsapp', to: normalizeForWhatsApp(to), type: 'template', template: { name: templateName, language: { code: languageCode }, components } };
  const res = await fetch(getApiUrl(), { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { const t = await res.text(); throw new Error('WhatsApp send failed: ' + res.status + ' ' + t); }
  const data = await res.json() as { messages?: { id: string }[] };
  return { externalId: data.messages?.[0]?.id ?? '' };
}

export async function sendTextMessage(to: string, text: string): Promise<SendResult> {
  const recipient = normalizeForWhatsApp(to);
  const body = { messaging_product: 'whatsapp', to: recipient, type: 'text', text: { body: text } };
  const res = await fetch(getApiUrl(), { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { const t = await res.text(); throw new Error('WhatsApp send failed: ' + res.status + ' ' + t); }
  const data = await res.json() as { messages?: { id: string }[] };
  return { externalId: data.messages?.[0]?.id ?? '' };
}

export async function sendInteractiveButtons(
  to: string, bodyText: string, buttons: { id: string; title: string }[],
): Promise<SendResult> {
  const body = { messaging_product: 'whatsapp', to: normalizeForWhatsApp(to), type: 'interactive', interactive: { type: 'button', body: { text: bodyText }, action: { buttons: buttons.slice(0, 3).map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) } } };
  const res = await fetch(getApiUrl(), { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { const t = await res.text(); throw new Error('WhatsApp send failed: ' + res.status + ' ' + t); }
  const data = await res.json() as { messages?: { id: string }[] };
  return { externalId: data.messages?.[0]?.id ?? '' };
}

export async function sendSlotList(
  to: string, headerText: string, bodyText: string,
  slots: { id: string; title: string; description: string }[],
): Promise<SendResult> {
  const body = { messaging_product: 'whatsapp', to: normalizeForWhatsApp(to), type: 'interactive', interactive: { type: 'list', header: { type: 'text', text: headerText }, body: { text: bodyText }, action: { button: 'Odaberite termin', sections: [{ title: 'Slobodni termini', rows: slots.slice(0, 10).map(s => ({ id: s.id, title: s.title.slice(0, 24), description: s.description.slice(0, 72) })) }] } } };
  const res = await fetch(getApiUrl(), { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { const t = await res.text(); throw new Error('WhatsApp send failed: ' + res.status + ' ' + t); }
  const data = await res.json() as { messages?: { id: string }[] };
  return { externalId: data.messages?.[0]?.id ?? '' };
}
