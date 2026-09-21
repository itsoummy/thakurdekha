"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface AppConfig {
  routing: { provider: "google" | "estimate"; transit: boolean; estimated: boolean };
  assistant?: { enabled: boolean };
}

let cached: AppConfig | null = null;

export function useConfig(): AppConfig | null {
  const [cfg, setCfg] = useState<AppConfig | null>(cached);
  useEffect(() => {
    if (cached) return;
    let live = true;
    api<AppConfig>("/api/config")
      .then((c) => {
        cached = c;
        if (live) setCfg(c);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return cfg;
}
