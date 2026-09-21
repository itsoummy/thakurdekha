"use client";

import { btnGhost, btnPrimary } from "./ui";

export default function LocationPermissionDialog({
  onAllow,
  onCancel,
}: {
  onAllow: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center bg-black/50 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loc-title"
        className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl flex flex-col gap-3"
      >
        <h2 id="loc-title" className="text-lg font-semibold">
          Use your location?
        </h2>
        <p className="text-sm text-smoke">
          Allow location access to discover pandals near you and get directions from your current location.
          Your position is only used on this device to draw the map and route — we don&apos;t store it.
        </p>
        <div className="flex gap-2 justify-end">
          <button className={btnGhost} onClick={onCancel}>
            Not now
          </button>
          <button className={btnPrimary} onClick={onAllow}>
            Allow location
          </button>
        </div>
      </div>
    </div>
  );
}

export function locationErrorText(error: "denied" | "unavailable" | "timeout"): string {
  return error === "denied"
    ? "We couldn't access your location. You can still browse the map, or choose a starting point on the map manually."
    : error === "timeout"
      ? "Finding your location is taking too long. You can retry, or choose a starting point on the map."
      : "Your device's location isn't available right now. You can still browse the map or choose a location manually.";
}
