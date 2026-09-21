"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { FoodDTO, PandalDTO } from "@/server/repo";
import { api, ApiClientError, errorMessage } from "@/lib/api";
import { track } from "@/lib/analytics";
import { useHoppingList } from "@/context/HoppingListContext";
import { useAuth } from "@/context/AuthContext";
import { nearestMetroStations, formatDistance } from "@/lib/geo";
import { googleMapsDirectionsUrl } from "@/lib/spatial";
import ReportButton from "@/components/ReportButton";
import { btnGhost, btnPrimary, CardSkeleton, fullUrl, inputCls, Notice, Rating, Skeleton, TrustBadge } from "@/components/ui";

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-black/5 dark:bg-white/5" />,
});

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  author: string;
  createdAt: string;
}

const RADII = [500, 1000, 2000];

export default function PandalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isInList, togglePandal } = useHoppingList();
  const auth = useAuth();

  const [pandal, setPandal] = useState<PandalDTO | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [food, setFood] = useState<FoodDTO[] | null>(null);
  const [radius, setRadius] = useState(1000);
  const [sort, setSort] = useState<"distance" | "rating" | "popular">("distance");

  const loadReviews = useCallback(() => {
    api<{ data: Review[] }>(`/api/pandals/${encodeURIComponent(id)}/reviews`)
      .then((r) => setReviews(r.data))
      .catch(() => setReviews([]));
  }, [id]);

  useEffect(() => {
    const ac = new AbortController();
    api<{ data: PandalDTO }>(`/api/pandals/${encodeURIComponent(id)}`, { signal: ac.signal })
      .then((r) => {
        setPandal(r.data);
        setState("ok");
        track("pandal_viewed", { type: "PANDAL", id });
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setState(e instanceof ApiClientError && e.status === 404 ? "missing" : "error");
      });
     
    loadReviews();
    return () => ac.abort();
  }, [id, loadReviews]);

  useEffect(() => {
    if (!pandal) return;
    const ac = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFood(null);
    api<{ data: FoodDTO[] }>(
      `/api/food/nearby?lat=${pandal.latitude}&lng=${pandal.longitude}&radius=${radius}&sort=${sort}&limit=20`,
      { signal: ac.signal }
    )
      .then((r) => setFood(r.data))
      .catch((e) => e.name !== "AbortError" && setFood([]));
    return () => ac.abort();
  }, [pandal, radius, sort]);

  if (state === "loading")
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <CardSkeleton />
      </div>
    );
  if (state === "missing" || state === "error" || !pandal)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl font-bold">{state === "error" ? "Something went wrong" : "Pandal not found"}</h1>
        <p className="text-sm text-smoke">
          {state === "error" ? "We couldn't load this pandal right now. Please try again." : "This pandal may have been removed or is still awaiting review."}
        </p>
        <Link className={btnPrimary} href="/">Back to discovery</Link>
      </div>
    );

  const metros = nearestMetroStations({ lat: pandal.latitude, lng: pandal.longitude }, 3);
  const inList = isInList(pandal.id);
  const dest = { lat: pandal.latitude, lng: pandal.longitude };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-6">
      <Link href="/" className="text-sm text-smoke hover:text-sindoor w-fit">← Back to discovery</Link>

      <section className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{pandal.name}</h1>
            {pandal.nameBn && <p className="text-smoke">{pandal.nameBn}</p>}
            <div className="mt-1"><TrustBadge trust={pandal.trust} /></div>
          </div>
          {pandal.zone && (
            <span className="text-xs uppercase tracking-wide rounded-full bg-marigold/20 text-marigold px-3 py-1.5 whitespace-nowrap">
              {pandal.zone} Kolkata
            </span>
          )}
        </div>
        {pandal.description && <p className="text-sm">{pandal.description}</p>}
        <p className="text-sm">
          <span className="text-smoke">This year&apos;s theme: </span>
          <span className="font-medium">{pandal.currentTheme ?? "Not announced yet"}</span>
          {pandal.themeStatus && pandal.themeStatus !== "Confirmed" && pandal.currentTheme === null && (
            <span className="ml-2 text-xs text-marigold">({pandal.themeStatus})</span>
          )}
        </p>
        {pandal.history && pandal.history !== pandal.description && (
          <details className="text-sm">
            <summary className="cursor-pointer text-smoke">History</summary>
            <p className="mt-1">{pandal.history}</p>
          </details>
        )}
      </section>

      {pandal.images.length > 0 && (
        <section aria-label="Photos" className="flex gap-2 overflow-x-auto">
          {pandal.images.map((im) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={im} src={fullUrl(im)} alt={`${pandal.name} photo`} loading="lazy" className="h-48 rounded-lg object-cover" />
          ))}
        </section>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {pandal.establishedYear && <Stat label="Established" value={String(pandal.establishedYear)} />}
        {pandal.budgetRange && <Stat label="Budget" value={pandal.budgetRange} />}
        {pandal.crowdRating && <Stat label="Crowd (est.)" value={`${pandal.crowdRating}/5`} />}
        {pandal.openingTime && <Stat label="Hours" value={`${pandal.openingTime}–${pandal.closingTime}`} />}
        <div className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
          <div className="text-[10px] uppercase text-smoke">Visitor rating</div>
          <Rating rating={pandal.rating} count={pandal.reviewCount} />
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <Link className={btnPrimary} href={`/map?select=PANDAL:${pandal.id}`}>Get Directions</Link>
        <button
          className={inList ? `${btnPrimary} !bg-emerald-600` : btnGhost}
          aria-pressed={inList}
          onClick={() => {
            togglePandal(pandal.id);
            if (!inList) track("pandal_added_to_plan", { type: "PANDAL", id: pandal.id });
          }}
        >
          {inList ? "In My Puja List ✓" : "Add to Puja List"}
        </button>
        {auth.user ? (
          <>
            <button className={btnGhost} aria-pressed={auth.saved.has(pandal.id)} onClick={() => void auth.toggleSaved(pandal.id)}>
              {auth.saved.has(pandal.id) ? "Saved ✓" : "Save"}
            </button>
            <button className={btnGhost} aria-pressed={auth.visited.has(pandal.id)} onClick={() => void auth.toggleVisited(pandal.id)}>
              {auth.visited.has(pandal.id) ? "Visited ✓" : "Mark as visited"}
            </button>
          </>
        ) : (
          <Link className={btnGhost} href={`/login?next=/pandal/${pandal.id}`}>Sign in to save</Link>
        )}
        <a
          className={btnGhost}
          target="_blank"
          rel="noreferrer"
          href={googleMapsDirectionsUrl(dest)}
          onClick={() => track("external_navigation_clicked", { type: "PANDAL", id: pandal.id })}
        >
          Open in Google Maps ↗
        </a>
      </section>

      <section>
        <div className="h-72 overflow-hidden rounded-xl">
          <MapCanvas pandals={[pandal]} fit={[dest]} selected={{ type: "PANDAL", id: pandal.id }} />
        </div>
        <p className="text-xs text-smoke mt-1">{pandal.address}</p>
      </section>

      <section className="grid sm:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold mb-2">Getting there</h2>
          <ul className="flex flex-col gap-2">
            {pandal.nearestMetro && (
              <li className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
                Listed nearest metro: <span className="font-medium">{pandal.nearestMetro}</span>
              </li>
            )}
            {pandal.nearestBusStop && (
              <li className="text-sm rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
                Nearest bus stop: <span className="font-medium">{pandal.nearestBusStop}</span>
              </li>
            )}
            {metros.map(({ station, distanceM, walkMin }) => (
              <li key={station.id} className="flex items-center justify-between text-sm border border-black/10 dark:border-white/10 rounded-lg px-3 py-2">
                <span>
                  <span className="font-medium">{station.name}</span>{" "}
                  <span className="text-xs text-smoke">({station.line} Line)</span>
                </span>
                <span className="text-xs text-smoke whitespace-nowrap">{formatDistance(distanceM)} · ~{walkMin} min walk</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <h2 className="font-semibold">Food Near This Pandal</h2>
            <div className="flex gap-1">
              <select aria-label="Food radius" className="min-h-9 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 text-xs" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                {RADII.map((r) => <option key={r} value={r}>{r >= 1000 ? `${r / 1000} km` : `${r} m`}</option>)}
              </select>
              <select aria-label="Sort food" className="min-h-9 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 text-xs" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="distance">Distance</option>
                <option value="rating">Rating</option>
                <option value="popular">Community recommendations</option>
              </select>
            </div>
          </div>
          {food === null && <div className="flex flex-col gap-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>}
          {food?.length === 0 && <p className="text-sm text-smoke">No food recommendations found nearby yet.</p>}
          <ul className="flex flex-col gap-2">
            {food?.map((f) => (
              <li key={f.id}>
                <Link href={`/food/${f.id}`} className="flex items-center justify-between gap-2 text-sm border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5">
                  <span className="min-w-0">
                    <span className="font-medium">{f.name}</span>
                    {f.pujoSpecial && <span className="ml-1 text-[10px] text-marigold">★ pujo special</span>}
                    <span className="block text-xs text-smoke truncate">{f.category ?? "Food"}{f.priceRange ? ` · ${f.priceRange}` : ""}</span>
                    <Rating rating={f.rating} count={f.reviewCount} />
                  </span>
                  <span className="text-xs text-smoke whitespace-nowrap">{formatDistance(f.distanceMeters ?? 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link className={`${btnGhost} mt-2`} href={`/food/new?pandal=${pandal.id}`}>+ Recommend a Food Spot</Link>
        </div>
      </section>

      <ReviewsSection pandalId={pandal.id} reviews={reviews} onPosted={() => { loadReviews(); }} />

      <div className="flex justify-end"><ReportButton entityType="PANDAL" entityId={pandal.id} label="Report a problem with this pandal" /></div>
    </div>
  );
}

function ReviewsSection({ pandalId, reviews, onPosted }: { pandalId: string; reviews: Review[] | null; onPosted: () => void }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/pandals/${encodeURIComponent(pandalId)}/reviews`, { body: { rating, comment: comment || undefined } });
      setComment("");
      onPosted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">Visitor reviews</h2>
      {reviews === null && <Skeleton className="h-16 w-full" />}
      {reviews?.length === 0 && <p className="text-sm text-smoke">No reviews yet — be the first.</p>}
      <ul className="flex flex-col gap-2">
        {reviews?.map((r) => (
          <li key={r.id} className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{r.author}</span>
              <Rating rating={r.rating} count={0} />
            </div>
            {r.comment && <p className="mt-1">{r.comment}</p>}
            <div className="mt-1"><ReportButton entityType="PANDAL_REVIEW" entityId={r.id} /></div>
          </li>
        ))}
      </ul>
      {user ? (
        <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border border-black/10 dark:border-white/10 p-3">
          {error && <Notice tone="error">{error}</Notice>}
          <label className="flex items-center gap-2 text-sm">
            Your rating
            <select className={`${inputCls} !w-24`} value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
            </select>
          </label>
          <textarea className={`${inputCls} py-2 min-h-16`} placeholder="Share your experience (optional)" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className={btnPrimary} disabled={busy} type="submit">{busy ? "Posting…" : "Post review"}</button>
        </form>
      ) : (
        <p className="text-sm text-smoke"><Link className="underline" href={`/login?next=/pandal/${pandalId}`}>Sign in</Link> to leave a review.</p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2">
      <div className="text-[10px] uppercase text-smoke">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
