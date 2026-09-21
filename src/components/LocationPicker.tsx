"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { isWithinKolkata } from "@/lib/spatial";
import type { Place } from "@/lib/map/types";
import { useDebounced } from "./GlobalSearch";
import { inputCls, Notice } from "./ui";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />,
});

export interface PickedPlace {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

/** Search-then-tap location selection; users never type raw coordinates. */
export default function LocationPicker({
  type,
  value,
  onChange,
  onExisting,
}: {
  type: "pandal" | "food";
  value: PickedPlace | null;
  onChange: (p: PickedPlace) => void;
  onExisting?: (place: Place) => void;
}) {
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 350);
  const [existing, setExisting] = useState<Place[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (term.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExisting([]);
      setPlaces([]);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    api<{ existing: Place[]; places: Place[] }>(`/api/geocode/search?q=${encodeURIComponent(term)}&type=${type}`, { signal: ac.signal })
      .then((r) => {
        setExisting(r.existing);
        setPlaces(r.places);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setLoading(false);
      });
    return () => ac.abort();
  }, [term, type]);

  function choose(p: PickedPlace) {
    if (!isWithinKolkata(p.lat, p.lng)) {
      setNote("That location is outside Greater Kolkata. Please choose a spot within the city.");
      return;
    }
    setNote(null);
    onChange(p);
  }

  async function onMapClick(c: { lat: number; lng: number }) {
    choose({ ...c });
    try {
      const r = await api<{ data: { formatted: string } | null }>(`/api/geocode/reverse?lat=${c.lat}&lng=${c.lng}`);
      if (r.data) onChange({ ...c, address: r.data.formatted });
    } catch {
      // address is optional
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        className={inputCls}
        placeholder={type === "food" ? "Search for a food place or address…" : "Search for a pandal or address…"}
        aria-label="Search location"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {loading && <p className="text-xs text-smoke">Searching…</p>}
      {(existing.length > 0 || places.length > 0) && (
        <ul className="rounded-lg border border-black/10 dark:border-white/15 divide-y divide-black/5 dark:divide-white/10 text-sm">
          {existing.map((p) => (
            <li key={`e-${p.id}`}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => (onExisting ? onExisting(p) : choose({ lat: p.lat, lng: p.lng, name: p.name, address: p.address }))}
              >
                <span className="text-[10px] uppercase text-emerald-600 mr-2">Already listed</span>
                {p.name} <span className="text-xs text-smoke">{p.address}</span>
              </button>
            </li>
          ))}
          {places.map((p) => (
            <li key={`p-${p.id}`}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => choose({ lat: p.lat, lng: p.lng, name: p.name, address: p.address })}
              >
                {p.name} <span className="text-xs text-smoke">{p.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {term.length >= 2 && !loading && existing.length === 0 && places.length === 0 && (
        <p className="text-xs text-smoke">No matches — tap the map to drop a pin instead.</p>
      )}
      {note && <Notice tone="warn">{note}</Notice>}
      <div className="h-72 w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/15">
        <MapCanvas onMapClick={(c) => void onMapClick(c)} pick={value} fit={value ? [value] : null} />
      </div>
      <p className="text-xs text-smoke">
        {value ? (value.address ?? "Location selected") : "Tap the map to place the pin, or pick a search result."}
      </p>
    </div>
  );
}
