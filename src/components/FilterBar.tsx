"use client";

import { Zone } from "@/types";

const ZONES: Zone[] = [
  "North",
  "Central",
  "South",
  "South-East",
  "South-West",
  "East",
  "Central-East",
  "Salt Lake",
  "New Town",
  "Howrah",
];
const BUDGETS = ["Budget", "Mid", "Big Budget", "Theme Heavyweight"] as const;

export interface Filters {
  query: string;
  zone: Zone | "All";
  budget: (typeof BUDGETS)[number] | "All";
  sortBy: "trending" | "distance" | "crowd";
}

export function defaultFilters(): Filters {
  return { query: "", zone: "All", budget: "All", sortBy: "trending" };
}

export default function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-wrap">
      <input
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder="Search pandal name or theme..."
        className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-black/15 dark:border-white/20 bg-transparent text-sm"
      />
      <select
        value={filters.zone}
        onChange={(e) => onChange({ ...filters, zone: e.target.value as Filters["zone"] })}
        className="px-3 py-2 rounded-lg border border-black/15 dark:border-white/20 bg-transparent text-sm"
      >
        <option value="All">All zones</option>
        {ZONES.map((z) => (
          <option key={z} value={z}>{z}</option>
        ))}
      </select>
      <select
        value={filters.budget}
        onChange={(e) => onChange({ ...filters, budget: e.target.value as Filters["budget"] })}
        className="px-3 py-2 rounded-lg border border-black/15 dark:border-white/20 bg-transparent text-sm"
      >
        <option value="All">All budgets</option>
        {BUDGETS.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
      <select
        value={filters.sortBy}
        onChange={(e) => onChange({ ...filters, sortBy: e.target.value as Filters["sortBy"] })}
        className="px-3 py-2 rounded-lg border border-black/15 dark:border-white/20 bg-transparent text-sm"
      >
        <option value="trending">Sort: Trending</option>
        <option value="distance">Sort: Nearest to me</option>
        <option value="crowd">Sort: Least crowded</option>
      </select>
    </div>
  );
}
