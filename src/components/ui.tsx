"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-black/10 dark:bg-white/10 ${className}`} aria-hidden />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-2" data-testid="card-skeleton">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

const TRUST = {
  VERIFIED: { label: "Verified", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  COMMUNITY: { label: "Community recommendation", cls: "bg-marigold/20 text-marigold" },
  PENDING: { label: "Pending review", cls: "bg-black/10 dark:bg-white/10 text-smoke" },
} as const;

export function TrustBadge({ trust }: { trust: keyof typeof TRUST }) {
  const t = TRUST[trust];
  return <span className={`inline-block text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5 ${t.cls}`}>{t.label}</span>;
}

export function Rating({ rating, count }: { rating: number | null; count: number }) {
  if (rating === null) return <span className="text-xs text-smoke">No rating yet</span>;
  return (
    <span className="text-xs">
      <span className="text-marigold">★</span> {rating.toFixed(1)} <span className="text-smoke">({count})</span>
    </span>
  );
}

export const thumbUrl = (ref: string) => `/api/uploads/${ref.replace(/\.webp$/, ".thumb.webp")}`;
export const fullUrl = (ref: string) => `/api/uploads/${ref}`;

export function PlaceImage({ images, alt, className = "" }: { images: string[]; alt: string; className?: string }) {
  if (images[0]) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={thumbUrl(images[0])} alt={alt} loading="lazy" decoding="async" className={`object-cover ${className}`} />;
  }
  return (
    <div
      role="img"
      aria-label={`${alt} (no photo yet)`}
      className={`flex items-center justify-center bg-gradient-to-br from-sindoor/25 to-marigold/25 text-2xl ${className}`}
    >
      🪔
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "warn"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "border-sindoor/40 bg-sindoor/10"
      : tone === "warn"
        ? "border-marigold/40 bg-marigold/10"
        : "border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export function BottomSheet({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose?: () => void;
  label: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <section
      role="dialog"
      aria-label={label}
      className="lg:hidden fixed inset-x-0 bottom-0 z-[1100] max-h-[72dvh] overflow-y-auto rounded-t-2xl border-t border-black/10 dark:border-white/15 bg-background shadow-[0_-8px_30px_rgba(0,0,0,0.25)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="sticky top-0 z-10 flex justify-center bg-background pt-2 pb-1">
        <span className="h-1.5 w-10 rounded-full bg-black/20 dark:bg-white/25" />
      </div>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

export const btn =
  "inline-flex items-center justify-center gap-1 rounded-full px-4 min-h-11 text-sm font-medium transition-colors disabled:opacity-50";
export const btnPrimary = `${btn} bg-sindoor text-white hover:opacity-90`;
export const btnGhost = `${btn} border border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10`;
export const inputCls =
  "w-full min-h-11 px-3 rounded-lg border border-black/15 dark:border-white/20 bg-transparent text-sm";
