"use client";

export type MapFilter = "all" | "pandals" | "food" | "nearby" | "popular" | "saved";
export const FILTERS: { id: MapFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pandals", label: "Pandals" },
  { id: "food", label: "Food" },
  { id: "nearby", label: "Nearby" },
  { id: "popular", label: "Popular" },
  { id: "saved", label: "Saved" },
];
export const RADII = [500, 1000, 2000, 5000, 10000] as const;
export const radiusLabel = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${m} m`);

export default function MapFilters({
  filter,
  onFilter,
  radius,
  onRadius,
}: {
  filter: MapFilter;
  onFilter: (f: MapFilter) => void;
  radius: number;
  onRadius: (r: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-background/95 backdrop-blur p-2 shadow-lg border border-black/10 dark:border-white/10 max-w-full">
      <div role="tablist" aria-label="Map filter" className="flex gap-1 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => onFilter(f.id)}
            className={`shrink-0 min-h-9 px-3 rounded-full text-sm ${
              filter === f.id ? "bg-sindoor text-white" : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-smoke">
        Radius
        <select
          aria-label="Search radius"
          value={radius}
          onChange={(e) => onRadius(Number(e.target.value))}
          className="min-h-9 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 text-sm text-foreground"
        >
          {RADII.map((r) => (
            <option key={r} value={r}>
              {radiusLabel(r)}
            </option>
          ))}
        </select>
        {filter !== "nearby" && <span>(used by Nearby)</span>}
      </label>
    </div>
  );
}
