import { getDb, newId, slugify } from "@/server/db";
import { handle, json, limit, readJson } from "@/server/http";
import { requireUser } from "@/server/auth";
import { pandalSubmissionSchema } from "@/server/validation";
import { duplicatePandals } from "@/server/repo";

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  limit(req, "pandal-submit", 10, 3_600_000);
  const b = pandalSubmissionSchema.parse(await readJson(req));

  if (!b.force) {
    const dupes = await duplicatePandals(b);
    if (dupes.length) {
      return json(
        { error: { code: "POSSIBLE_DUPLICATE", message: "We may already have this pandal listed." }, duplicates: dupes },
        { status: 409 }
      );
    }
  }
  const id = newId("p_");
  await getDb()
    .prepare(
      `INSERT INTO pandals (id,name,slug,description,history,established_year,current_theme,latitude,longitude,address,
        neighbourhood,nearest_metro,nearest_bus_stop,images,verified,status,source,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'PENDING','community',?)`
    )
    .run(
      id, b.name, slugify(b.name), b.description ?? null, b.history ?? null, b.establishedYear ?? null,
      b.currentTheme ?? null, b.latitude, b.longitude, b.address ?? null, b.neighbourhood ?? null,
      b.nearestMetro ?? null, b.nearestBusStop ?? null, JSON.stringify(b.images), user.id
    );
  return json({ data: { id, status: "PENDING" } }, { status: 201 });
});
