"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Skeleton } from "./ui";

interface Results {
  pandals: { id: string; name: string; neighbourhood: string | null; zone: string | null }[];
  food: { id: string; name: string; category: string | null }[];
  transport: { id: string; name: string; line: string }[];
  areas: { name: string; pandalCount: number }[];
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function GlobalSearch({ className = "" }: { className?: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const term = useDebounced(q.trim(), 250);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!term) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRes(null);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(false);
    api<Results>(`/api/search?q=${encodeURIComponent(term)}`, { signal: ac.signal })
      .then((r) => {
        setRes(r);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(true);
          setLoading(false);
        }
      });
    return () => ac.abort();
  }, [term]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const empty = res && !res.pandals.length && !res.food.length && !res.transport.length && !res.areas.length;
  const close = () => setOpen(false);

  return (
    <div ref={box} className={`relative ${className}`}>
      <input
        type="search"
        role="searchbox"
        aria-label="Search pandals, food, areas, metro"
        placeholder="Search pandals, food, areas, metro…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full min-h-10 px-3 rounded-full border border-black/15 dark:border-white/20 bg-transparent text-sm"
      />
      {open && term && (
        <div className="absolute left-0 right-0 top-12 z-[1300] max-h-[70dvh] overflow-y-auto rounded-xl border border-black/10 dark:border-white/15 bg-background p-2 shadow-xl text-sm">
          {loading && (
            <div className="flex flex-col gap-2 p-2" data-testid="search-skeleton">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
          {error && <p className="p-2 text-smoke">Search isn&apos;t working right now. Please try again.</p>}
          {empty && !loading && <p className="p-2 text-smoke">We couldn&apos;t find anything matching that search.</p>}
          {!loading && res && (
            <>
              <Group title="Pandals" show={res.pandals.length > 0}>
                {res.pandals.map((p) => (
                  <Link key={p.id} onClick={close} className="block rounded-md px-2 py-2 hover:bg-black/5 dark:hover:bg-white/10" href={`/map?select=PANDAL:${p.id}`}>
                    {p.name} <span className="text-xs text-smoke">{p.neighbourhood ?? p.zone}</span>
                  </Link>
                ))}
              </Group>
              <Group title="Food" show={res.food.length > 0}>
                {res.food.map((f) => (
                  <Link key={f.id} onClick={close} className="block rounded-md px-2 py-2 hover:bg-black/5 dark:hover:bg-white/10" href={`/map?select=FOOD:${f.id}`}>
                    {f.name} <span className="text-xs text-smoke">{f.category}</span>
                  </Link>
                ))}
              </Group>
              <Group title="Transport" show={res.transport.length > 0}>
                {res.transport.map((t) => (
                  <div key={t.id} className="px-2 py-2">
                    🚇 {t.name} <span className="text-xs text-smoke">{t.line} Line</span>
                  </div>
                ))}
              </Group>
              <Group title="Areas" show={res.areas.length > 0}>
                {res.areas.map((a) => (
                  <Link key={a.name} onClick={close} className="block rounded-md px-2 py-2 hover:bg-black/5 dark:hover:bg-white/10" href={`/?q=${encodeURIComponent(a.name)}`}>
                    {a.name} <span className="text-xs text-smoke">{a.pandalCount} pandals</span>
                  </Link>
                ))}
              </Group>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, show, children }: { title: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <div className="mb-1">
      <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-smoke">{title}</div>
      {children}
    </div>
  );
}
