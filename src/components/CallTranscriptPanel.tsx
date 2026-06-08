'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

export type TranscriptTurn = {
  role?: string;
  message?: string;
  text?: string;
};

export type CallRow = {
  id: string;
  provider: string;
  providerCallId: string;
  status: string;
  direction: string;
  fromNumber: string | null;
  toNumber: string | null;
  summary: string | null;
  outcome: string | null;
  transcript: string | null;
  metadata: unknown;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSec: number | null;
  patient: { id: string; fullName: string } | null;
};

function formatDuration(durationSec: number | null) {
  if (!durationSec || durationSec <= 0) return '--';
  const min = Math.floor(durationSec / 60);
  const sec = durationSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function callerLabel(call: CallRow) {
  return call.patient?.fullName ?? call.fromNumber ?? 'Unknown caller';
}

function extractTurns(metadata: unknown): TranscriptTurn[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const turns = (metadata as { transcriptTurns?: TranscriptTurn[] }).transcriptTurns;
  return Array.isArray(turns) ? turns : [];
}

function turnText(turn: TranscriptTurn) {
  return (turn.message ?? turn.text ?? '').trim();
}

function isAgentRole(role: string) {
  const r = role.toLowerCase();
  return r === 'agent' || r === 'assistant' || r === 'ai';
}

function parsePlainTranscript(transcript: string): TranscriptTurn[] {
  return transcript
    .split('\n')
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx <= 0) return { role: 'unknown', message: line.trim() };
      return {
        role: line.slice(0, idx).trim(),
        message: line.slice(idx + 1).trim(),
      };
    })
    .filter((t) => turnText(t));
}

type Props = {
  calls: CallRow[];
  initialCallId?: string;
};

export default function CallTranscriptPanel({ calls, initialCallId }: Props) {
  const defaultId = useMemo(() => {
    if (initialCallId && calls.some((c) => c.id === initialCallId)) return initialCallId;
    const withTranscript = calls.find((c) => c.transcript?.trim());
    return withTranscript?.id ?? calls[0]?.id ?? null;
  }, [calls, initialCallId]);

  const [selectedId, setSelectedId] = useState<string | null>(defaultId);
  const [copied, setCopied] = useState(false);

  const selected = calls.find((c) => c.id === selectedId) ?? null;

  const turns = useMemo(() => {
    if (!selected) return [];
    const structured = extractTurns(selected.metadata);
    if (structured.length > 0) return structured;
    if (selected.transcript?.trim()) return parsePlainTranscript(selected.transcript);
    return [];
  }, [selected]);

  async function handleCopy() {
    if (!selected?.transcript) return;
    await navigator.clipboard.writeText(selected.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (calls.length === 0) {
    return (
      <div className="col-span-12 bg-surface-container-lowest rounded-xl shadow-sm px-6 py-12 text-center">
        <span className="material-symbols-outlined text-4xl text-outline mb-3">phone_in_talk</span>
        <p className="text-sm text-on-surface-variant">No calls recorded yet</p>
        <p className="text-xs text-on-surface-variant mt-2">
          Transcripts appear after post-call webhooks from Retell or ElevenLabs.
        </p>
      </div>
    );
  }

  return (
    <div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-container-low">
          <h3 className="font-headline font-bold text-on-surface">Recent Calls</h3>
        </div>
        <div className="divide-y divide-surface-container-low max-h-[32rem] overflow-y-auto">
          {calls.map((call) => {
            const active = call.id === selectedId;
            return (
              <button
                key={call.id}
                type="button"
                onClick={() => setSelectedId(call.id)}
                className={`w-full text-left px-5 py-4 transition-colors ${
                  active ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {callerLabel(call)}
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {call.provider}
                      {call.outcome ? ` · ${call.outcome}` : ''}
                    </p>
                    {call.startedAt && (
                      <p className="text-[10px] text-on-surface-variant mt-1">
                        {new Date(call.startedAt).toLocaleString('bs-BA')}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-low px-2 py-1 rounded shrink-0">
                    {formatDuration(call.durationSec)}
                  </span>
                </div>
                {call.transcript && (
                  <p className="text-[10px] text-on-surface-variant mt-2 line-clamp-2">{call.transcript}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col min-h-[24rem]">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm">
            Select a call to view transcript
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-surface-container-low flex items-start justify-between gap-4">
              <div>
                <h3 className="font-headline font-bold text-on-surface">{callerLabel(selected)}</h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  {selected.provider} · {selected.status} · {selected.direction}
                  {selected.outcome ? ` · ${selected.outcome}` : ''}
                </p>
                {selected.summary && (
                  <p className="text-sm text-on-surface mt-3 bg-surface-container-low rounded-lg px-3 py-2">
                    <span className="font-semibold text-on-surface-variant text-xs uppercase tracking-wide block mb-1">
                      Summary
                    </span>
                    {selected.summary}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Link
                  href={`/voice-ai/calls/${selected.id}`}
                  className="text-xs font-semibold text-on-surface-variant hover:text-primary"
                >
                  Open full page
                </Link>
                {selected.transcript && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {copied ? 'Copied' : 'Copy transcript'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {turns.length > 0 ? (
                turns.map((turn, i) => {
                  const role = turn.role ?? 'unknown';
                  const text = turnText(turn);
                  const agent = isAgentRole(role);
                  return (
                    <div
                      key={i}
                      className={`flex ${agent ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                          agent
                            ? 'bg-surface-container-low text-on-surface'
                            : 'bg-primary/10 text-on-surface'
                        }`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant mb-1">
                          {agent ? 'Agent' : 'Caller'}
                        </p>
                        <p className="leading-relaxed whitespace-pre-wrap">{text}</p>
                      </div>
                    </div>
                  );
                })
              ) : selected.transcript ? (
                <pre className="text-sm text-on-surface whitespace-pre-wrap font-mono leading-relaxed">
                  {selected.transcript}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="material-symbols-outlined text-4xl text-outline mb-3">call_end</span>
                  <p className="text-sm text-on-surface-variant">No transcript for this call yet</p>
                  <p className="text-xs text-on-surface-variant mt-2 max-w-sm">
                    Ensure post-call webhook is configured and the worker is running.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
