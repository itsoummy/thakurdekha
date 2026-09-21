"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
}

interface Submission {
  id: string;
  name: string;
  status: string;
  moderatorNotes: string | null;
  createdAt: string;
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  saved: Set<string>;
  visited: Set<string>;
  submissions: Submission[];
  foodSubmissions: Submission[];
  login(email: string, password: string): Promise<void>;
  register(email: string, name: string, password: string): Promise<void>;
  logout(): Promise<void>;
  toggleSaved(pandalId: string): Promise<void>;
  toggleVisited(pandalId: string): Promise<void>;
  refresh(): Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [foodSubmissions, setFoodSubmissions] = useState<Submission[]>([]);

  const loadState = useCallback(async () => {
    try {
      const s = await api<{ saved: string[]; visited: string[]; submissions: Submission[]; foodSubmissions: Submission[] }>(
        "/api/users/me/state"
      );
      setSaved(new Set(s.saved));
      setVisited(new Set(s.visited));
      setSubmissions(s.submissions);
      setFoodSubmissions(s.foodSubmissions);
    } catch {
      setSaved(new Set());
      setVisited(new Set());
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api<{ user: User | null }>("/api/auth/me");
      setUser(user);
      if (user) await loadState();
      else {
        setSaved(new Set());
        setVisited(new Set());
        setSubmissions([]);
        setFoodSubmissions([]);
      }
    } finally {
      setLoading(false);
    }
  }, [loadState]);

  useEffect(() => {
     
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      await api("/api/auth/login", { body: { email, password } });
      await refresh();
    },
    [refresh]
  );
  const register = useCallback(
    async (email: string, name: string, password: string) => {
      await api("/api/auth/register", { body: { email, name, password } });
      await refresh();
    },
    [refresh]
  );
  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    await refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (kind: "save" | "visited", id: string) => {
      const set = kind === "save" ? saved : visited;
      const setter = kind === "save" ? setSaved : setVisited;
      const has = set.has(id);
      const next = new Set(set);
      if (has) next.delete(id);
      else next.add(id);
      setter(next);
      try {
        await api(`/api/pandals/${encodeURIComponent(id)}/${kind}`, { method: has ? "DELETE" : "POST" });
        if (!has) track(kind === "save" ? "pandal_saved" : "pandal_visited", { type: "PANDAL", id });
      } catch (e) {
        setter(set);
        throw e;
      }
    },
    [saved, visited]
  );

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      saved,
      visited,
      submissions,
      foodSubmissions,
      login,
      register,
      logout,
      refresh,
      toggleSaved: (id) => toggle("save", id),
      toggleVisited: (id) => toggle("visited", id),
    }),
    [user, loading, saved, visited, submissions, foodSubmissions, login, register, logout, refresh, toggle]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
