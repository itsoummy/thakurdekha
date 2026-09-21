"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { thumbUrl } from "./ui";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ImageUploader({
  value,
  onChange,
  max = 4,
}: {
  value: string[];
  onChange: (names: string[]) => void;
  max?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    const next = [...value];
    for (const file of Array.from(files)) {
      if (next.length >= max) break;
      if (!TYPES.includes(file.type)) {
        setError("Only JPEG, PNG or WebP images are allowed.");
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError("Images must be 8 MB or smaller.");
        continue;
      }
      try {
        const fd = new FormData();
        fd.set("file", file);
        const r = await api<{ data: { name: string } }>("/api/uploads", { formData: fd });
        next.push(r.data.name);
      } catch (e) {
        setError(errorMessage(e));
      }
    }
    onChange(next);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {value.map((n) => (
          <div key={n} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbUrl(n)} alt="Uploaded photo" className="h-20 w-20 rounded-md object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onChange(value.filter((x) => x !== n))}
              className="absolute -right-1 -top-1 h-6 w-6 rounded-full bg-black/70 text-white text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        {value.length < max && (
          <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-md border border-dashed border-black/30 dark:border-white/30 text-xs text-smoke">
            {busy ? "Uploading…" : "+ Photo"}
            <input type="file" accept={TYPES.join(",")} multiple className="sr-only" disabled={busy} onChange={(e) => void onFiles(e.target.files)} />
          </label>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-sindoor">{error}</p>}
    </div>
  );
}
