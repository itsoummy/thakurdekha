import { z } from "zod";
import { handle, json, limit } from "@/server/http";
import { listFood, listPandals } from "@/server/repo";
import { parseQuery } from "@/server/validation";
import { metroStations } from "@/data/metroStations";

const q = z.object({ q: z.string().trim().min(1).max(100) });

export const GET = handle(async (req) => {
  limit(req, "search", 120);
  const { q: term } = parseQuery(q, req);
  const t = term.toLowerCase();

  const pandals = (await listPandals({ q: term, limit: 8, sort: "popular" })).data;
  const food = (await listFood({ q: term, limit: 8, sort: "rating" })).data;
  const transport = metroStations
    .filter((m) => m.name.toLowerCase().includes(t) || `${m.line} line`.includes(t))
    .slice(0, 6)
    .map((m) => ({ id: m.id, name: m.name, line: m.line, latitude: m.lat, longitude: m.lng }));

  const areaMap = new Map<string, number>();
  for (const p of (await listPandals({ limit: 500 })).data) {
    for (const a of [p.zone, p.neighbourhood]) {
      if (a && a.toLowerCase().includes(t)) areaMap.set(a, (areaMap.get(a) ?? 0) + 1);
    }
  }
  const areas = [...areaMap].map(([name, pandalCount]) => ({ name, pandalCount })).slice(0, 6);

  return json({ pandals, food, transport, areas }, { cache: "public, s-maxage=15, stale-while-revalidate=60" });
});
