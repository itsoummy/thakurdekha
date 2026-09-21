"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { btnGhost, inputCls, Notice, Skeleton } from "@/components/ui";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  envAdmin: boolean;
  createdAt: string;
  pandalSubmissions: number;
  foodSubmissions: number;
  reviews: number;
}

export default function UsersTab({ selfId }: { selfId: string }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((term: string) => {
    api<{ data: AdminUser[] }>(`/api/admin/users?limit=100&q=${encodeURIComponent(term)}`)
      .then((r) => {
        setUsers(r.data);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  async function setRole(u: AdminUser, role: "USER" | "ADMIN") {
    if (!confirm(role === "ADMIN" ? `Make ${u.email} an admin?` : `Remove admin rights from ${u.email}?`)) return;
    try {
      await api(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: "PATCH", body: { role } });
      load(q);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input className={`${inputCls} max-w-sm`} placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      {error && <Notice tone="error">{error}</Notice>}
      {!users && !error && <Skeleton className="h-32 w-full" />}
      {users && users.length === 0 && <p className="text-sm text-smoke">No users found.</p>}
      {users && users.length > 0 && (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id} className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">
                  {u.name} <span className="text-xs text-smoke">{u.email}</span>
                </div>
                <div className="text-xs text-smoke">
                  Joined {new Date(u.createdAt).toLocaleDateString()} · {u.pandalSubmissions} pandals · {u.foodSubmissions} food places · {u.reviews} reviews
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs rounded-full px-2 py-0.5 border ${u.role === "ADMIN" ? "border-sindoor text-sindoor" : "border-black/15 dark:border-white/20 text-smoke"}`}>
                  {u.role === "ADMIN" ? (u.envAdmin ? "Admin (env)" : "Admin") : "User"}
                </span>
                {u.id === selfId ? (
                  <span className="text-xs text-smoke">You</span>
                ) : u.role === "ADMIN" ? (
                  <button className={btnGhost} disabled={u.envAdmin} title={u.envAdmin ? "Set through ADMIN_EMAILS" : undefined} onClick={() => void setRole(u, "USER")}>
                    Remove admin
                  </button>
                ) : (
                  <button className={btnGhost} onClick={() => void setRole(u, "ADMIN")}>
                    Make admin
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
