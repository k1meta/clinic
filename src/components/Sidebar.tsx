"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { useEffect, useState } from "react";

const navItems = [
  { icon: "dashboard", label: "Overview", href: "/" },
  { icon: "calendar_month", label: "Calendar", href: "/calendar" },
  { icon: "group", label: "Patients", href: "/patients" },
  { icon: "chat", label: "Messages", href: "/messages" },
  { icon: "mic", label: "Voice AI", href: "/voice-ai" },
  { icon: "auto_awesome", label: "Automations", href: "#" },
  { icon: "rate_review", label: "Reviews", href: "#" },
  { icon: "query_stats", label: "Analytics", href: "#" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userMeta, setUserMeta] = useState<{ fullName: string; initials: string }>({
    fullName: "Loading...",
    initials: "..",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name ?? user.email ?? "User";
        const initials = name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        setUserMeta({ fullName: name, initials });
      }
    });
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 bg-[#f7f9fb] py-6 px-4 sticky top-0 font-headline text-sm font-medium tracking-tight">
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
      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest px-2 -mt-8 mb-8">
        Primary Care Center
      </p>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 ${
                isActive
                  ? "text-primary font-bold border-r-2 border-primary bg-[#f2f4f6]"
                  : "text-slate-500 hover:text-slate-900 hover:bg-[#f2f4f6]"
              }`}
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
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 ${
            pathname === "/settings"
              ? "text-primary font-bold border-r-2 border-primary bg-[#f2f4f6]"
              : "text-slate-500 hover:bg-[#f2f4f6]"
          }`}
        >
          <span className="material-symbols-outlined" style={pathname === "/settings" ? { fontVariationSettings: "'FILL' 1" } : undefined}>settings</span>
          <span>Settings</span>
        </Link>
        <div className="mt-6 pt-6 border-t border-surface-container-high flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-primary-container overflow-hidden flex items-center justify-center text-white text-xs font-bold">
            {userMeta.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-on-surface truncate">{userMeta.fullName}</p>
            <p className="text-[10px] text-slate-500">Primary Care Center</p>
          </div>
          <button onClick={handleSignOut} className="p-1.5 rounded-lg hover:bg-[#f2f4f6] transition-colors" title="Sign out">
            <span className="material-symbols-outlined text-slate-400 text-lg">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}