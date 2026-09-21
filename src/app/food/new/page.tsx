"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiClientError, errorMessage } from "@/lib/api";
import { track } from "@/lib/analytics";
import type { PandalDTO } from "@/server/repo";
import type { Place } from "@/lib/map/types";
import RequireAuth from "@/components/RequireAuth";
import LocationPicker, { type PickedPlace } from "@/components/LocationPicker";
import ImageUploader from "@/components/ImageUploader";
import { btnGhost, btnPrimary, inputCls, Notice } from "@/components/ui";

interface Dupe {
  id: string;
  name: string;
  address?: string | null;
}

export default function NewFoodPage() {
  return (
    <RequireAuth reason="Sign in to recommend a food spot. Recommendations are reviewed before they appear publicly.">
      <Suspense>
        <Flow />
      </Suspense>
    </RequireAuth>
  );
}

function Stars({ value, onChange }: { value: number | undefined; onChange: (n: number | undefined) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(value === n ? undefined : n)}
          className={`h-11 w-11 rounded-full border text-lg ${value && n <= value ? "bg-marigold/30 border-marigold" : "border-black/15 dark:border-white/20"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Flow() {
  const initialPandal = useSearchParams().get("pandal");
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [existing, setExisting] = useState<Place | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [dish, setDish] = useState("");
  const [rating, setRating] = useState<number>();
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [pandalIds, setPandalIds] = useState<string[]>(initialPandal ? [initialPandal] : []);
  const [nearby, setNearby] = useState<PandalDTO[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupes, setDupes] = useState<Dupe[]>([]);
  const [done, setDone] = useState(false);

  const at = existing ?? place;
  useEffect(() => {
    if (!at) return;
    const ac = new AbortController();
    api<{ data: PandalDTO[] }>(`/api/pandals/nearby?lat=${at.lat}&lng=${at.lng}&radius=2000&limit=12`, { signal: ac.signal })
      .then((r) => setNearby(r.data))
      .catch(() => {});
    return () => ac.abort();
  }, [at]);

  async function submit(force = false) {
    setBusy(true);
    setError(null);
    try {
      if (existing) {
        await api(`/api/food/${encodeURIComponent(existing.id)}/recommend`, {
          body: { rating, comment: comment || undefined, recommendedDish: dish || undefined, pandalId: pandalIds[0], images },
        });
      } else {
        if (!place) throw new Error("no place");
        await api("/api/food", {
          body: {
            name,
            latitude: place.lat,
            longitude: place.lng,
            address: place.address || undefined,
            category: category || undefined,
            priceRange: priceRange || undefined,
            recommendedDish: dish || undefined,
            rating,
            comment: comment || undefined,
            pandalIds,
            images,
            force: force || undefined,
          },
        });
      }
      track("food_recommendation_submitted");
      setDone(true);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "POSSIBLE_DUPLICATE") setDupes((e.extra?.duplicates as Dupe[]) ?? []);
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl font-bold">Thanks for the recommendation!</h1>
        <p className="text-sm text-smoke">A moderator will review it. Once approved it will appear as a community recommendation.</p>
        <Link className={btnPrimary} href="/map">Back to the map</Link>
      </div>
    );

  const step = existing ? "existing" : creatingNew && place ? "new" : "search";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Recommend a Food Spot</h1>

      {step === "search" && (
        <>
          <p className="text-sm text-smoke">
            Search first — if the place is already listed you can recommend it instead of creating a duplicate.
          </p>
          <LocationPicker
            type="food"
            value={place}
            onChange={(p) => {
              setPlace(p);
              if (p.name && !name) setName(p.name);
            }}
            onExisting={(p) => setExisting(p)}
          />
          <button className={btnPrimary} disabled={!place} onClick={() => setCreatingNew(true)}>
            This isn&apos;t listed — add it as new
          </button>
        </>
      )}

      {step !== "search" && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setDupes([]);
            void submit();
          }}
        >
          {existing ? (
            <Notice>
              Recommending <strong>{existing.name}</strong>{" "}
              <button type="button" className="underline" onClick={() => setExisting(null)}>change</button>
            </Notice>
          ) : (
            <>
              <button type="button" className="text-sm underline text-smoke w-fit" onClick={() => setCreatingNew(false)}>
                ← Back to search
              </button>
              <label className="flex flex-col gap-1 text-sm">
                Name *
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  Category
                  <input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Biryani, Sweets…" maxLength={60} />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Price range
                  <select className={inputCls} value={priceRange} onChange={(e) => setPriceRange(e.target.value)}>
                    <option value="">Not sure</option>
                    <option value="₹">₹</option>
                    <option value="₹₹">₹₹</option>
                    <option value="₹₹₹">₹₹₹</option>
                  </select>
                </label>
              </div>
            </>
          )}

          {dupes.length > 0 && (
            <Notice tone="warn">
              <p className="font-medium">We may already have this place listed.</p>
              <ul className="mt-1 list-disc pl-5">
                {dupes.map((d) => (
                  <li key={d.id}>
                    {d.name}{" "}
                    <button type="button" className="underline" onClick={() => { setExisting({ id: d.id, name: d.name, lat: place!.lat, lng: place!.lng, source: "community" }); setDupes([]); }}>
                      Recommend this one instead
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className={`${btnGhost} mt-2`} onClick={() => void submit(true)}>Continue Anyway</button>
            </Notice>
          )}
          {error && <Notice tone="error">{error}</Notice>}

          <label className="flex flex-col gap-1 text-sm">
            Recommended dish
            <input className={inputCls} value={dish} onChange={(e) => setDish(e.target.value)} maxLength={120} />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            Rating
            <Stars value={rating} onChange={setRating} />
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Comment
            <textarea className={`${inputCls} min-h-20 py-2`} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
          </label>
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend>Nearby pandal{existing ? "" : "s"}</legend>
            {nearby.length === 0 && <span className="text-xs text-smoke">No pandals found within 2 km.</span>}
            {nearby.map((p) => (
              <label key={p.id} className="flex items-center gap-2 min-h-9">
                <input
                  type={existing ? "radio" : "checkbox"}
                  name="pandal"
                  checked={pandalIds.includes(p.id)}
                  onChange={(e) =>
                    setPandalIds((ids) => (existing ? [p.id] : e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id)))
                  }
                />
                {p.name} <span className="text-xs text-smoke">{p.distanceMeters} m</span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1 text-sm">
            Photos
            <ImageUploader value={images} onChange={setImages} />
          </div>
          <button className={btnPrimary} disabled={busy || (!existing && !name.trim()) || (!rating && !comment && !dish)} type="submit">
            {busy ? "Submitting…" : "Submit for review"}
          </button>
          {!rating && !comment && !dish && <p className="text-xs text-smoke">Add a rating, dish or comment to submit.</p>}
        </form>
      )}
    </div>
  );
}
