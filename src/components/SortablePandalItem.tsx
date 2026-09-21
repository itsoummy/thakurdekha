"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";

export interface StopView {
  id: string;
  type: "PANDAL" | "FOOD";
  name: string;
  sub?: string | null;
  lat: number;
  lng: number;
}

export default function SortableStopItem({
  stop,
  index,
  legLabel,
  onRemove,
}: {
  stop: StopView;
  index: number;
  legLabel?: string;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const href = stop.type === "PANDAL" ? `/pandal/${stop.id}` : `/food/${stop.id}`;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2.5"
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Drag ${stop.name} to reorder`}
        className="cursor-grab active:cursor-grabbing text-smoke px-2 min-h-11 select-none touch-none"
      >
        ⠿
      </button>
      <span
        className={`flex items-center justify-center w-6 h-6 text-white text-xs font-semibold shrink-0 ${
          stop.type === "PANDAL" ? "rounded-full bg-sindoor" : "rounded-md bg-marigold"
        }`}
      >
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <Link href={href} className="font-medium hover:text-sindoor truncate block">
          {stop.type === "FOOD" ? "🍴 " : ""}
          {stop.name}
        </Link>
        {stop.sub && <div className="text-xs text-smoke truncate">{stop.sub}</div>}
      </div>
      {legLabel && <span className="text-xs text-smoke whitespace-nowrap">{legLabel}</span>}
      <button onClick={() => onRemove(stop.id)} aria-label={`Remove ${stop.name}`} className="text-smoke hover:text-sindoor px-2 min-h-11">
        ✕
      </button>
    </li>
  );
}
