export type ForwardingCode = { label: string; code: string };

/** BH Telecom mobile codes. Forwarding is offered only to numbers inside BiH. */
export function bhTelecomMobileCodes(e164: string): ForwardingCode[] {
  const national = e164.startsWith('+387') ? '0' + e164.slice(4) : null;
  if (!national) return [];
  return [
    { label: 'Kad se ne javite', code: `**61*${national}#` },
    { label: 'Kad je linija zauzeta', code: `**67*${national}#` },
    { label: 'Kad je telefon isključen ili nedostupan', code: `**62*${national}#` },
  ];
}

export const CHECK_CODES: ForwardingCode[] = [
  { label: 'Provjera (nejavljanje)', code: '*#61#' },
  { label: 'Isključi sva preusmjeravanja', code: '##002#' },
];
