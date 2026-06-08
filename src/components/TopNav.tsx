"use client";

import type { UserRole } from "@/db/queries/auth";

type TopNavProps = {
  displayName: string;
  role: UserRole;
};

export default function TopNav({ displayName, role }: TopNavProps) {
  return (
    <header className="flex justify-between items-center h-16 px-8 sticky top-0 z-50 bg-white/80 backdrop-blur-xl shadow-sm font-headline font-semibold">
      <div className="flex items-center gap-6 flex-1">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            search
          </span>
          <input
            className="w-full bg-surface-container-low border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 transition-all font-body"
            placeholder="Search patients, appointments, or records..."
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold leading-none">{displayName}</p>
            <p className="text-[10px] text-slate-500 mt-1 capitalize">{role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
