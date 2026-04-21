'use client';

import { useState, useRef, useEffect, useTransition, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { updateAppointmentStatus } from '@/app/actions/appointments';

type Props = {
  appointmentId: string;
  currentStatus: string;
  children: React.ReactNode;
};

const STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Confirmed', icon: 'event_available', color: 'text-primary' },
  { value: 'arrived', label: 'Arrived', icon: 'login', color: 'text-green-600' },
  { value: 'completed', label: 'Completed', icon: 'check_circle', color: 'text-slate-600' },
  { value: 'no_show', label: 'No Show', icon: 'person_cancel', color: 'text-red-600' },
  { value: 'cancelled', label: 'Cancelled', icon: 'cancel', color: 'text-slate-400' },
];

const MENU_HEIGHT_ESTIMATE = 240;
const MENU_WIDTH = 220;

export default function AppointmentStatusMenu({ appointmentId, currentStatus, children }: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [open, closeMenu]);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }

    const el = triggerRef.current?.firstElementChild as HTMLElement | null;
    const rect = el?.getBoundingClientRect() ?? (e.currentTarget as HTMLElement).getBoundingClientRect();
    let x = rect.right + 8;
    let y = rect.top;

    if (y + MENU_HEIGHT_ESTIMATE > window.innerHeight) {
      y = window.innerHeight - MENU_HEIGHT_ESTIMATE - 8;
      if (y < 8) y = 8;
    }
    if (x + MENU_WIDTH > window.innerWidth) {
      x = rect.left - MENU_WIDTH - 8;
    }
    if (x < 8) x = 8;

    setMenuPos({ x, y });
    setOpen(true);
  }

  function handleStatusChange(status: string) {
    startTransition(async () => {
      await updateAppointmentStatus(appointmentId, status);
      setOpen(false);
    });
  }

  const dropdown = open ? (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white rounded-xl shadow-xl border border-surface-container-high/50 py-1 min-w-[200px]"
      style={{ top: menuPos.y, left: menuPos.x, maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}
    >
      <div className="px-3 py-2 border-b border-surface-container-high/30">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Change Status</p>
      </div>
      {STATUS_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => handleStatusChange(opt.value)}
          disabled={isPending || opt.value === currentStatus}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-surface-container-low transition-colors disabled:opacity-40 ${opt.value === currentStatus ? 'bg-primary/5 font-bold' : ''}`}
        >
          <span className={`material-symbols-outlined text-base ${opt.color}`}>{opt.icon}</span>
          <span className={opt.value === currentStatus ? 'text-primary font-bold' : ''}>{opt.label}</span>
          {opt.value === currentStatus && (
            <span className="material-symbols-outlined text-primary text-sm ml-auto">check</span>
          )}
        </button>
      ))}

      {isPending && (
        <div className="px-3 py-2 text-xs text-slate-400 text-center border-t border-surface-container-high/30">
          Updating...
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <div ref={triggerRef} onClick={handleClick} className="cursor-pointer">
        {children}
      </div>
      {dropdown && createPortal(dropdown, document.body)}
    </>
  );
}