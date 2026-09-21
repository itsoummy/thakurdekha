"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiClientError, errorMessage } from "@/lib/api";
import { track } from "@/lib/analytics";
import RequireAuth from "@/components/RequireAuth";
import LocationPicker, { type PickedPlace } from "@/components/LocationPicker";
import ImageUploader from "@/components/ImageUploader";
import { btnGhost, btnPrimary, inputCls, Notice } from "@/components/ui";

interface Dupe {
  id: string;
  name: string;
  address?: string | null;
}

export default function NewPandalPage() {
  return (
    <RequireAuth reason="Sign in to add a missing pandal. Submissions are reviewed before they appear on the map.">
      <Form />
    </RequireAuth>
  );
}

function Form() {
  const [name, setName] = useState("");
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [description, setDescription] = useState("");
  const [history, setHistory] = useState("");
  const [theme, setTheme] = useState("");
  const [year, setYear] = useState("");
  const [metro, setMetro] = useState("");
  const [bus, setBus] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupes, setDupes] = useState<Dupe[]>([]);
  const [done, setDone] = useState(false);

  async function submit(force = false) {
    if (!place) return setError("Choose the pandal's location on the map or from search.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/pandals/submissions", {
        body: {
          name,
          latitude: place.lat,
          longitude: place.lng,
          address: place.address || undefined,
          description: description || undefined,
          history: history || undefined,
          currentTheme: theme || undefined,
          establishedYear: year ? Number(year) : undefined,
          nearestMetro: metro || undefined,
          nearestBusStop: bus || undefined,
          images,
          force: force || undefined,
        },
      });
      track("pandal_submitted");
      setDone(true);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "POSSIBLE_DUPLICATE") {
        setDupes((e.extra?.duplicates as Dupe[]) ?? []);
      } else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl font-bold">Thank you!</h1>
        <p className="text-sm text-smoke">
          Your pandal is now pending review. It will appear on the map as a community recommendation once a moderator approves it.
        </p>
        <Link className={btnPrimary} href="/map">Back to the map</Link>
      </div>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDupes([]);
        void submit();
      }}
      className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4"
    >
      <h1 className="text-2xl font-bold">Add a Pandal</h1>
      {error && <Notice tone="error">{error}</Notice>}
      {dupes.length > 0 && (
        <Notice tone="warn">
          <p className="font-medium">We may already have this pandal listed.</p>
          <ul className="mt-1 list-disc pl-5">
            {dupes.map((d) => (
              <li key={d.id}>
                {d.name} {d.address ? <span className="text-smoke">— {d.address}</span> : null}{" "}
                <Link className="underline" href={`/map?select=PANDAL:${d.id}`}>View Existing</Link>
              </li>
            ))}
          </ul>
          <button type="button" className={`${btnGhost} mt-2`} onClick={() => void submit(true)}>
            Continue Anyway
          </button>
        </Notice>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Name *
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        Location *
        <LocationPicker type="pandal" value={place} onChange={setPlace} />
      </div>
      <label className="flex flex-col gap-1 text-sm">
        This year&apos;s theme
        <input className={inputCls} value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={200} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description
        <textarea className={`${inputCls} min-h-24 py-2`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        History
        <textarea className={`${inputCls} min-h-24 py-2`} value={history} onChange={(e) => setHistory(e.target.value)} maxLength={4000} />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Established year
          <input className={inputCls} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nearest metro
          <input className={inputCls} value={metro} onChange={(e) => setMetro(e.target.value)} maxLength={100} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Nearest bus stop
          <input className={inputCls} value={bus} onChange={(e) => setBus(e.target.value)} maxLength={100} />
        </label>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        Photos
        <ImageUploader value={images} onChange={setImages} />
      </div>
      <button className={btnPrimary} disabled={busy || !name.trim()} type="submit">
        {busy ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
