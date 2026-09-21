"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api";
import { track } from "@/lib/analytics";
import { useConfig } from "@/hooks/useConfig";
import { useHoppingList } from "@/context/HoppingListContext";
import RequireAuth from "@/components/RequireAuth";
import { btnGhost, btnPrimary, inputCls, Notice } from "@/components/ui";
import type { AssistantResult, AssistantStop } from "@/server/gemini";

interface Msg {
  role: "user" | "model";
  text: string;
  title?: string;
  stops?: AssistantStop[];
}

const SUGGESTIONS = [
  "Plan a 4-hour South Kolkata pandal route with a good food stop",
  "Which pandals are near a metro station in North Kolkata?",
  "Budget-friendly pandals and street food around Central Kolkata",
];

export default function AssistantPage() {
  return (
    <RequireAuth reason="Sign in to chat with the pandal-hopping assistant.">
      <Chat />
    </RequireAuth>
  );
}

function Chat() {
  const cfg = useConfig();
  const { pandalIds, addPandal } = useHoppingList();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text: t }];
    setMsgs(next);
    setInput("");
    setError(null);
    setBusy(true);
    try {
      const history = next.slice(-10).map(({ role, text }) => ({ role, text }));
      const r = await api<{ data: AssistantResult }>("/api/assistant", { body: { messages: history } });
      setMsgs([...next, { role: "model", text: r.data.reply, title: r.data.title, stops: r.data.stops }]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function addAll(stops: AssistantStop[]) {
    for (const s of stops) {
      addPandal(s.id);
      track("pandal_added_to_plan", { type: s.type, id: s.id });
    }
  }

  const disabled = cfg && cfg.assistant && !cfg.assistant.enabled;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Pandal-hopping assistant</h1>
        <p className="text-sm text-smoke">
          Ask for a route. It only suggests pandals and food from our listings; unverified details are flagged, and it can be wrong, so check before you go.
        </p>
      </div>

      {disabled && <Notice tone="warn">The assistant isn&apos;t switched on for this site yet.</Notice>}

      <div className="flex flex-col gap-3" aria-live="polite">
        {msgs.length === 0 && (
          <div className="flex flex-col gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} className={`${btnGhost} justify-start text-left h-auto py-2`} onClick={() => void send(s)} disabled={!!disabled || busy}>
                {s}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "self-end max-w-[85%]" : "self-start max-w-full w-full"}>
            <div
              className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-sindoor text-white" : "border border-black/10 dark:border-white/15"
              }`}
            >
              {m.text}
            </div>
            {m.stops && m.stops.length > 0 && (
              <div className="mt-2 rounded-xl border border-black/10 dark:border-white/15 p-3 flex flex-col gap-2">
                <h2 className="font-semibold text-sm">{m.title ?? "Suggested route"}</h2>
                <ol className="flex flex-col gap-1 text-sm">
                  {m.stops.map((s, n) => (
                    <li key={s.id} className="flex gap-2">
                      <span className="text-smoke w-5 shrink-0">{n + 1}.</span>
                      <span>
                        <Link className="underline" href={s.type === "PANDAL" ? `/pandal/${s.id}` : `/food/${s.id}`}>
                          {s.name}
                        </Link>{" "}
                        <span className="text-xs text-smoke">{s.type === "FOOD" ? "food" : "pandal"}</span>
                        {s.note && <span className="block text-xs text-smoke">{s.note}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <button className={btnPrimary} onClick={() => addAll(m.stops!)}>
                    {m.stops.every((s) => pandalIds.includes(s.id)) ? "Added to My List ✓" : "Add all to My List"}
                  </button>
                  <Link className={btnGhost} href="/my-list">
                    Open My List
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}

        {busy && <div className="self-start text-sm text-smoke animate-pulse">Thinking…</div>}
        {error && <Notice tone="error">{error}</Notice>}
        <div ref={endRef} />
      </div>

      <form
        className="flex gap-2 sticky bottom-0 bg-background py-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          className={inputCls}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. 3 pandals near Baghbazar and somewhere for phuchka"
          aria-label="Ask the assistant"
          maxLength={1000}
          disabled={!!disabled}
        />
        <button className={btnPrimary} type="submit" disabled={busy || !input.trim() || !!disabled}>
          Send
        </button>
      </form>
    </div>
  );
}
