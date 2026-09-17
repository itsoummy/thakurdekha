"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Pandal } from "@/types";

export default function SortablePandalItem({
  pandal,
  index,
  legDistanceLabel,
  onRemove,
}: {
  pandal: Pandal;
  index: number;
  legDistanceLabel?: string;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: pandal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2.5"
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab active:cursor-grabbing text-smoke px-1 select-none touch-none"
      >
        ⠿
      </button>
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sindoor text-white text-xs font-semibold shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <Link href={`/pandal/${pandal.id}`} className="font-medium hover:text-sindoor truncate block">
          {pandal.name}
        </Link>
        <div className="text-xs text-smoke truncate">{pandal.zone} · {pandal.theme}</div>
      </div>
      {legDistanceLabel && (
        <span className="text-xs text-smoke whitespace-nowrap">{legDistanceLabel}</span>
      )}
      <button
        onClick={() => onRemove(pandal.id)}
        aria-label="Remove from list"
        className="text-smoke hover:text-sindoor px-1"
      >
        ✕
      </button>
    </li>
  );
}
