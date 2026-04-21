'use client';

import { useState, useTransition } from 'react';
import { getThread, sendReply } from '@/app/actions/messages';

interface Conversation {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  lastContent: string;
  lastChannel: string;
  lastAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  channel: string;
  direction: string;
  type: string;
  status: string;
  content: string;
  readByStaff: boolean;
  createdAt: string;
}

export default function MessagesInbox({ conversations }: { conversations: Conversation[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [isPending, startTransition] = useTransition();

  const selectedConvo = conversations.find(c => c.patientId === selected);

  function openThread(patientId: string) {
    setSelected(patientId);
    startTransition(async () => {
      const msgs = await getThread(patientId);
      setThread(msgs);
    });
  }

  function handleSendReply() {
    if (!selected || !reply.trim()) return;
    const channel = selectedConvo?.lastChannel === 'sms' ? 'sms' as const : 'whatsapp' as const;
    startTransition(async () => {
      await sendReply({ patientId: selected, content: reply.trim(), channel });
      setReply('');
      const msgs = await getThread(selected);
      setThread(msgs);
    });
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1) return Math.floor(diffMs / 60000) + 'm ago';
    if (diffHours < 24) return Math.floor(diffHours) + 'h ago';
    return d.toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit' });
  }

  return (
    <div className="flex bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden h-full">
      {/* Conversation list */}
      <div className="w-80 border-r border-surface-container-high/30 flex flex-col">
        <div className="px-4 py-3 border-b border-surface-container-high/30">
          <p className="text-xs font-bold text-on-surface">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">No messages yet</div>
          ) : (
            conversations.map(c => (
              <button
                key={c.patientId}
                onClick={() => openThread(c.patientId)}
                className={"w-full text-left px-4 py-3 border-b border-surface-container-high/10 hover:bg-surface-container-high/20 transition-colors " + (selected === c.patientId ? 'bg-primary/5' : '')}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-semibold text-on-surface truncate">{c.patientName}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatTime(c.lastAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-xs text-slate-400">
                    {c.lastChannel === 'sms' ? 'sms' : 'chat'}
                  </span>
                  <span className="text-xs text-slate-500 truncate flex-1">{c.lastContent}</span>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread panel */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <span className="material-symbols-outlined text-4xl mb-2 block">forum</span>
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="px-6 py-3 border-b border-surface-container-high/30 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-white text-xs font-bold">
                {selectedConvo?.patientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">{selectedConvo?.patientName}</p>
                <p className="text-[10px] text-slate-400">{selectedConvo?.patientPhone ?? 'No phone'}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 flex flex-col-reverse">
              {thread.map(msg => (
                <div key={msg.id} className={"flex " + (msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                  <div className={"max-w-[70%] rounded-2xl px-4 py-2 " + (msg.direction === 'outbound' ? 'bg-primary text-white' : 'bg-surface-container-high/40 text-on-surface')}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <div className={"flex items-center gap-1.5 mt-1 " + (msg.direction === 'outbound' ? 'justify-end' : '')}>
                      <span className={"text-[10px] " + (msg.direction === 'outbound' ? 'text-white/60' : 'text-slate-400')}>
                        {formatTime(msg.createdAt)}
                      </span>
                      {msg.direction === 'outbound' && (
                        <span className={"text-[10px] " + (msg.direction === 'outbound' ? 'text-white/60' : 'text-slate-400')}>
                          {msg.status === 'read' ? '\u2713\u2713' : msg.status === 'delivered' ? '\u2713\u2713' : msg.status === 'sent' ? '\u2713' : msg.status === 'failed' ? '\u2717' : '\u23F3'}
                        </span>
                      )}
                      <span className="material-symbols-outlined text-xs" style={{ fontSize: '12px' }}>
                        {msg.channel === 'sms' ? 'sms' : 'chat'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply input */}
            <div className="px-6 py-3 border-t border-surface-container-high/30 flex gap-2">
              <input
                type="text"
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                placeholder="Type a reply..."
                className="flex-1 rounded-xl border border-outline/20 px-4 py-2 text-sm bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleSendReply}
                disabled={isPending || !reply.trim()}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-base" style={{ fontSize: '18px' }}>send</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
