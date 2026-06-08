"use client";

import type { UserRole } from "@/db/queries/auth";
import ThemeToggle from "@/components/ThemeToggle";

type TopNavProps = {
  displayName: string;
  role: UserRole;
};

export default function TopNav({ displayName, role }: TopNavProps) {
  return (
    <header className="flex justify-between items-center h-16 px-8 sticky top-0 z-50 bg-surface-container-lowest/80 backdrop-blur-xl shadow-sm font-headline font-semibold border-b border-surface-container-high/50">
      <div className="flex items-center gap-6 flex-1">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
            search
          </span>
          <input
            className="w-full bg-surface-container-low border-none rounded-lg py-2 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary/20 transition-all font-body"
            placeholder="Search patients, appointments, or records..."
            type="text"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="flex items-center gap-3 pl-2 border-l border-surface-container-high">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold leading-none text-on-surface">{displayName}</p>
            <p className="text-[10px] text-on-surface-variant mt-1 capitalize">{role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
