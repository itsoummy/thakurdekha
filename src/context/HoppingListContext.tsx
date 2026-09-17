"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "thakurdekha:hopping-list";

interface HoppingListContextValue {
  pandalIds: string[];
  addPandal: (id: string) => void;
  removePandal: (id: string) => void;
  togglePandal: (id: string) => void;
  reorder: (ids: string[]) => void;
  clear: () => void;
  isInList: (id: string) => boolean;
}

const HoppingListContext = createContext<HoppingListContextValue | null>(null);

export function HoppingListProvider({ children }: { children: React.ReactNode }) {
  const [pandalIds, setPandalIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setPandalIds(JSON.parse(raw));
    } catch {
      // ignore malformed/blocked storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pandalIds));
    } catch {
      // ignore blocked storage (private mode, etc.)
    }
  }, [pandalIds, hydrated]);

  const addPandal = useCallback((id: string) => {
    setPandalIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removePandal = useCallback((id: string) => {
    setPandalIds((prev) => prev.filter((p) => p !== id));
  }, []);

  const togglePandal = useCallback((id: string) => {
    setPandalIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  const reorder = useCallback((ids: string[]) => setPandalIds(ids), []);
  const clear = useCallback(() => setPandalIds([]), []);
  const isInList = useCallback(
    (id: string) => pandalIds.includes(id),
    [pandalIds]
  );

  const value = useMemo(
    () => ({ pandalIds, addPandal, removePandal, togglePandal, reorder, clear, isInList }),
    [pandalIds, addPandal, removePandal, togglePandal, reorder, clear, isInList]
  );

  return (
    <HoppingListContext.Provider value={value}>
      {children}
    </HoppingListContext.Provider>
  );
}

export function useHoppingList() {
  const ctx = useContext(HoppingListContext);
  if (!ctx) throw new Error("useHoppingList must be used within HoppingListProvider");
  return ctx;
}
