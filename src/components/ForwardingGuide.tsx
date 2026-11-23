'use client';

import { useState } from 'react';
import { bhTelecomMobileCodes, CHECK_CODES, type ForwardingCode } from '@/lib/voice/forwarding';

function CodeRow({ item }: { item: ForwardingCode }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(item.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2">
      <span className="text-sm text-on-surface-variant">{item.label}</span>
      <span className="flex items-center gap-2">
        <code className="text-sm font-semibold text-on-surface bg-surface-container-low rounded px-3 py-2">{item.code}</code>
        <button type="button" onClick={handleCopy} className="min-h-11 px-3 text-xs font-semibold text-primary hover:underline">
          {copied ? 'Kopirano' : 'Kopiraj'}
        </button>
      </span>
    </li>
  );
}

export default function ForwardingGuide({ numbers }: { numbers: string[] }) {
  return (
    <section className="col-span-12 bg-surface-container-lowest rounded-xl shadow-sm p-6 space-y-4">
      <div>
        <h3 className="font-headline font-bold text-on-surface">Preusmjeravanje poziva na AI</h3>
        <p className="text-sm text-on-surface-variant mt-1">
          Vaš broj ostaje isti. Prvo zvoni kod Vas, a AI preuzima samo pozive koje ne primite.
        </p>
      </div>

      {numbers.length === 0 && (
        <p className="text-sm text-on-surface-variant">
          Još nema AI broja. Povežite ga naredbom <code>npm run voice:number</code>.
        </p>
      )}

      {numbers.map((number) => {
        const codes = bhTelecomMobileCodes(number);
        return (
          <div key={number}>
            <p className="text-sm font-semibold text-on-surface">AI broj: {number}</p>
            {codes.length > 0 ? (
              <>
                <p className="text-xs text-on-surface-variant mt-1">
                  BH Telecom mobilni: ukucajte kod kao broj telefona i pritisnite poziv.
                </p>
                <ul className="divide-y divide-surface-container-low mt-2">
                  {codes.map((item) => <CodeRow key={item.code} item={item} />)}
                </ul>
              </>
            ) : (
              <p className="text-sm text-error mt-1">
                Ovo nije broj iz BiH. BH Telecom ne nudi preusmjeravanje na strane brojeve.
              </p>
            )}
          </div>
        );
      })}

      <div>
        <p className="text-sm font-semibold text-on-surface">Provjera i isključivanje</p>
        <ul className="divide-y divide-surface-container-low mt-2">
          {CHECK_CODES.map((item) => <CodeRow key={item.code} item={item} />)}
        </ul>
      </div>

      <p className="text-xs text-on-surface-variant">
        Preusmjereni poziv plaćate kao običan poziv prema AI broju. Za fiksne linije kod glasi <code>*61*broj#</code>.
        Za m:tel, HT Eronet i druge operatere kodove potvrdite s operaterom.
      </p>
    </section>
  );
}
