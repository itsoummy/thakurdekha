"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { btnPrimary, Skeleton } from "./ui";

export default function RequireAuth({ children, reason }: { children: React.ReactNode; reason: string }) {
  const { user, loading } = useAuth();
  const path = usePathname();
  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10 flex flex-col gap-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl font-bold">Sign in to continue</h1>
        <p className="text-sm text-smoke">{reason}</p>
        <Link className={btnPrimary} href={`/login?next=${encodeURIComponent(path)}`}>
          Sign in
        </Link>
        <Link className="text-sm underline text-smoke" href="/register">
          Create an account
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
