"use client";

import { useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { btnGhost, btnPrimary, inputCls, Notice } from "./ui";

const REASONS = [
  ["INCORRECT_INFO", "Incorrect information"],
  ["DUPLICATE", "Duplicate"],
  ["CLOSED", "Closed location"],
  ["WRONG_LOCATION", "Wrong location"],
  ["SPAM", "Spam"],
  ["INAPPROPRIATE", "Inappropriate content"],
  ["OTHER", "Other"],
] as const;

export default function ReportButton({
  entityType,
  entityId,
  label = "Report",
}: {
  entityType: "PANDAL" | "FOOD" | "PANDAL_REVIEW" | "FOOD_RECOMMENDATION";
  entityId: string;
  label?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("INCORRECT_INFO");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  if (!user) {
    return (
      <Link className="text-xs underline text-smoke" href="/login">
        Sign in to report
      </Link>
    );
  }
  if (!open) {
    return (
      <button className="text-xs underline text-smoke" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/reports", { body: { entityType, entityId, reason, description: description || undefined } });
      setMsg({ tone: "info", text: "Thanks — a moderator will take a look." });
      setOpen(false);
    } catch (err) {
      setMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border border-black/10 dark:border-white/15 p-3 text-sm">
      <label className="flex flex-col gap-1">
        Reason
        <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <textarea className={`${inputCls} py-2 min-h-16`} placeholder="Details (optional)" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={busy} type="submit">Send report</button>
        <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
