import { Suspense } from "react";
import MapExplorer from "@/components/MapExplorer";

export const metadata = { title: "Map — Thakurdekha" };

export default function MapPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100dvh-57px)] animate-pulse bg-black/5 dark:bg-white/5" />}>
      <MapExplorer />
    </Suspense>
  );
}
