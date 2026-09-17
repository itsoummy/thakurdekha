"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHoppingList } from "@/context/HoppingListContext";

export default function Header() {
  const pathname = usePathname();
  const { pandalIds } = useHoppingList();

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        pathname === href
          ? "bg-sindoor text-white"
          : "text-smoke hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 dark:border-white/10 bg-background/90 backdrop-blur">
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2 shrink-0">
          <span className="text-xl font-bold text-sindoor">Thakurdekha</span>
          <span className="hidden sm:inline text-xs text-smoke">ঠাকুর দেখা</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navLink("/", "Discover")}
          {navLink(
            "/my-list",
            `My List${pandalIds.length ? ` (${pandalIds.length})` : ""}`
          )}
        </nav>
      </div>
    </header>
  );
}
