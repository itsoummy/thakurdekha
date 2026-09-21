"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { FoodDTO } from "@/server/repo";
import { api, ApiClientError } from "@/lib/api";
import { track } from "@/lib/analytics";
import { useHoppingList } from "@/context/HoppingListContext";
import { googleMapsDirectionsUrl } from "@/lib/spatial";
import ReportButton from "@/components/ReportButton";
import { btnGhost, btnPrimary, fullUrl, Rating, Skeleton, TrustBadge } from "@/components/ui";

const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-black/5 dark:bg-white/5" />,
});

interface Reco {
  id: string;
  rating: number | null;
  comment: string | null;
  recommendedDish: string | null;
  author: string;
}

export default function FoodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isInList, togglePandal } = useHoppingList();
  const [food, setFood] = useState<FoodDTO | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [recos, setRecos] = useState<Reco[] | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    api<{ data: FoodDTO }>(`/api/food/${encodeURIComponent(id)}`, { signal: ac.signal })
      .then((r) => {
        setFood(r.data);
        setState("ok");
        track("food_place_viewed", { type: "FOOD", id });
      })
      .catch((e) => e.name !== "AbortError" && setState(e instanceof ApiClientError && e.status === 404 ? "missing" : "error"));
    api<{ data: Reco[] }>(`/api/food/${encodeURIComponent(id)}/reviews`, { signal: ac.signal })
      .then((r) => setRecos(r.data))
      .catch(() => setRecos([]));
    return () => ac.abort();
  }, [id]);

  if (state === "loading")
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  if (!food)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center flex flex-col items-center gap-3">
        <h1 className="text-xl font-bold">{state === "error" ? "Something went wrong" : "Place not found"}</h1>
        <Link className={btnPrimary} href="/map">Back to the map</Link>
      </div>
    );

  const dest = { lat: food.latitude, lng: food.longitude };
  const inList = isInList(food.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-5">
      <Link href="/map" className="text-sm text-smoke hover:text-sindoor w-fit">← Back to the map</Link>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{food.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <TrustBadge trust={food.trust} />
          <Rating rating={food.rating} count={food.reviewCount} />
          {food.pujoSpecial && <span className="text-xs text-marigold">★ pujo special</span>}
        </div>
        {food.description && <p className="text-sm">{food.description}</p>}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm max-w-sm">
          <dt className="text-smoke">Category</dt><dd>{food.category ?? "—"}</dd>
          <dt className="text-smoke">Recommended dish</dt><dd>{food.recommendedDish ?? "—"}</dd>
          <dt className="text-smoke">Price range</dt><dd>{food.priceRange ?? "—"}</dd>
        </dl>
      </section>

      {food.images.length > 0 && (
        <section className="flex gap-2 overflow-x-auto">
          {food.images.map((im) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={im} src={fullUrl(im)} alt={`${food.name} photo`} loading="lazy" className="h-40 rounded-lg object-cover" />
          ))}
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        <Link className={btnPrimary} href={`/map?select=FOOD:${food.id}`}>Get Directions</Link>
        <button className={inList ? `${btnPrimary} !bg-emerald-600` : btnGhost} aria-pressed={inList} onClick={() => togglePandal(food.id)}>
          {inList ? "In Puja List ✓" : "Add as a stop"}
        </button>
        <a className={btnGhost} target="_blank" rel="noreferrer" href={googleMapsDirectionsUrl(dest)} onClick={() => track("external_navigation_clicked", { type: "FOOD", id: food.id })}>
          Open in Google Maps ↗
        </a>
      </section>

      <div className="h-64 overflow-hidden rounded-xl">
        <MapCanvas food={[food]} fit={[dest]} selected={{ type: "FOOD", id: food.id }} />
      </div>
      {food.address && <p className="text-xs text-smoke">{food.address}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Community recommendations</h2>
        {recos === null && <Skeleton className="h-14 w-full" />}
        {recos?.length === 0 && <p className="text-sm text-smoke">No recommendations yet.</p>}
        <ul className="flex flex-col gap-2">
          {recos?.map((r) => (
            <li key={r.id} className="rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{r.author}</span>
                <Rating rating={r.rating} count={0} />
              </div>
              {r.recommendedDish && <p className="text-xs text-smoke">Try: {r.recommendedDish}</p>}
              {r.comment && <p className="mt-1">{r.comment}</p>}
              <div className="mt-1"><ReportButton entityType="FOOD_RECOMMENDATION" entityId={r.id} /></div>
            </li>
          ))}
        </ul>
        <Link className={`${btnGhost} w-fit`} href="/food/new">+ Recommend a Food Spot</Link>
      </section>

      <div className="flex justify-end"><ReportButton entityType="FOOD" entityId={food.id} label="Report a problem with this place" /></div>
    </div>
  );
}
