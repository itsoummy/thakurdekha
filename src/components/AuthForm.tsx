"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api";
import { btnPrimary, inputCls, Notice } from "./ui";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, name, password);
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/map");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm px-4 py-10 flex flex-col gap-3">
      <h1 className="text-2xl font-bold">{mode === "login" ? "Sign in" : "Create your account"}</h1>
      <p className="text-sm text-smoke">
        {mode === "login"
          ? "Sign in to save pandals, add recommendations and build routes."
          : "Join to add missing pandals, share food spots and save your Puja plans."}
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      {mode === "register" && (
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          className={inputCls}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "register" ? 8 : 1}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        {mode === "register" && <span className="text-xs text-smoke">At least 8 characters.</span>}
      </label>
      <button className={btnPrimary} disabled={busy} type="submit">
        {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
      <p className="text-sm text-smoke">
        {mode === "login" ? (
          <>New here? <Link className="underline" href="/register">Create an account</Link></>
        ) : (
          <>Already have an account? <Link className="underline" href="/login">Sign in</Link></>
        )}
      </p>
    </form>
  );
}
