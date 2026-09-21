"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHoppingList } from "@/context/HoppingListContext";
import { useAuth } from "@/context/AuthContext";
import GlobalSearch from "./GlobalSearch";

export default function Header() {
  const pathname = usePathname();
  const { pandalIds } = useHoppingList();
  const { user, loading, logout } = useAuth();

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-3 min-h-9 inline-flex items-center rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
        pathname === href ? "bg-sindoor text-white" : "text-smoke hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-[1400] border-b border-black/10 dark:border-white/10 bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-6xl flex items-center gap-3 px-4 py-2 h-[57px]">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="" width={36} height={36} priority className="h-9 w-9 rounded-lg" />
          <span className="text-xl font-bold text-sindoor">Thakurdekha</span>
        </Link>
        <GlobalSearch className="hidden md:block flex-1 max-w-md" />
        <nav className="flex items-center gap-1 ml-auto overflow-x-auto">
          {navLink("/", "Discover")}
          {navLink("/map", "Map")}
          {navLink("/my-list", `My List${pandalIds.length ? ` (${pandalIds.length})` : ""}`)}
          {!loading &&
            (user ? (
              <>
                {user.role === "ADMIN" && navLink("/admin", "Admin")}
                <button
                  onClick={() => void logout()}
                  className="px-3 min-h-9 rounded-full text-sm text-smoke hover:bg-black/5 dark:hover:bg-white/10 whitespace-nowrap"
                  title={user.email}
                >
                  Sign out
                </button>
              </>
            ) : (
              navLink("/login", "Sign in")
            ))}
        </nav>
      </div>
    </header>
  );
}
