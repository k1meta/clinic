"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { UserRole } from "@/db/queries/auth";

const navItems: { icon: string; label: string; href: string; adminOnly?: boolean }[] = [
  { icon: "dashboard", label: "Overview", href: "/" },
  { icon: "calendar_month", label: "Calendar", href: "/calendar" },
  { icon: "group", label: "Patients", href: "/patients" },
  { icon: "chat", label: "Messages", href: "/messages" },
  { icon: "mic", label: "Voice AI", href: "/voice-ai" },
  { icon: "auto_awesome", label: "Automations", href: "/automations", adminOnly: true },
  { icon: "rate_review", label: "Reviews", href: "/reviews", adminOnly: true },
  { icon: "campaign", label: "Campaigns", href: "/campaigns", adminOnly: true },
  { icon: "query_stats", label: "Analytics", href: "/analytics", adminOnly: true },
];

type SidebarProps = {
  role: UserRole;
  clinicName: string;
  fullName: string;
  initials: string;
};

export default function Sidebar({ role, clinicName, fullName, initials }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const isAdmin = role === 'admin';

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 ${
      isActive
        ? "text-primary font-bold border-r-2 border-primary bg-surface-container-low"
        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
    }`;

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 bg-surface py-6 px-4 sticky top-0 font-headline text-sm font-medium tracking-tight border-r border-surface-container-high/50">
      <div className="mb-10 px-2 flex items-center gap-3">
        <span
          className="material-symbols-outlined text-primary text-2xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          medical_services
        </span>
        <span className="text-xl font-bold text-primary tracking-tighter">
          ClinicOS
        </span>
      </div>
      <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-widest px-2 -mt-8 mb-8">
        {clinicName}
      </p>

      <nav className="flex-1 space-y-1">
        {navItems.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={linkClass(isActive)}
            >
              <span
                className="material-symbols-outlined"
                style={
                  isActive
                    ? { fontVariationSettings: "'FILL' 1" }
                    : undefined
                }
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        {isAdmin && (
          <Link
            href="/settings"
            className={linkClass(pathname === "/settings")}
          >
            <span className="material-symbols-outlined" style={pathname === "/settings" ? { fontVariationSettings: "'FILL' 1" } : undefined}>settings</span>
            <span>Settings</span>
          </Link>
        )}
        <div className="mt-6 pt-6 border-t border-surface-container-high flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-primary-container overflow-hidden flex items-center justify-center text-on-primary text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-on-surface truncate">{fullName}</p>
            <p className="text-[10px] text-on-surface-variant capitalize">{role} · {clinicName}</p>
          </div>
          <button onClick={handleSignOut} className="p-1.5 rounded-lg hover:bg-surface-container-low transition-colors" title="Sign out">
            <span className="material-symbols-outlined text-outline text-lg">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
