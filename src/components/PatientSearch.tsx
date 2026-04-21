"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

export default function PatientSearch({
  search,
  status,
}: {
  search: string;
  status: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/patients?${params.toString()}`);
  }

  function handleSearch(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams("q", value), 300);
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 mb-8 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            person_search
          </span>
          <input
            className="w-full bg-surface-container-low border-none rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary/20 font-body"
            placeholder="Search by name, phone, or email..."
            type="text"
            defaultValue={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <select
          className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 font-body"
          defaultValue={status}
          onChange={(e) => updateParams("status", e.target.value)}
        >
          <option value="">Patient Status</option>
          <option value="active">Active</option>
          <option value="new">New</option>
          <option value="inactive">Inactive</option>
        </select>
        <select className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-primary/20 font-body">
          <option value="">Assigned Doctor</option>
        </select>
      </div>
    </div>
  );
}
