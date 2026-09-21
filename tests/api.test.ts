import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { freshDb, params, register, req } from "./helpers";
import { getDb } from "@/server/db";

process.env.ADMIN_EMAILS = "admin@example.com";
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `td-uploads-${process.pid}`);
delete process.env.GOOGLE_MAPS_API_KEY;

import * as authRegister from "@/app/api/auth/register/route";
import * as authLogin from "@/app/api/auth/login/route";
import * as pandalsList from "@/app/api/pandals/route";
import * as pandalsNearby from "@/app/api/pandals/nearby/route";
import * as pandalOne from "@/app/api/pandals/[id]/route";
import * as pandalSubmit from "@/app/api/pandals/submissions/route";
import * as pandalSave from "@/app/api/pandals/[id]/save/route";
import * as pandalVisited from "@/app/api/pandals/[id]/visited/route";
import * as pandalReviews from "@/app/api/pandals/[id]/reviews/route";
import * as foodList from "@/app/api/food/route";
import * as foodNearby from "@/app/api/food/nearby/route";
import * as foodRecommend from "@/app/api/food/[id]/recommend/route";
import * as foodReviews from "@/app/api/food/[id]/reviews/route";
import * as routes from "@/app/api/routes/route";
import * as optimize from "@/app/api/routes/optimize/route";
import * as uploads from "@/app/api/uploads/route";
import * as reports from "@/app/api/reports/route";
import * as plans from "@/app/api/plans/route";
import * as adminQueue from "@/app/api/admin/queue/route";
import * as adminPandal from "@/app/api/admin/pandals/[id]/route";
import * as adminFood from "@/app/api/admin/food/[id]/route";
import * as adminContent from "@/app/api/admin/content/[kind]/[id]/route";
import * as search from "@/app/api/search/route";
import * as assistant from "@/app/api/assistant/route";
import * as authMe from "@/app/api/auth/me/route";

const KOLKATA = { lat: 22.5726, lng: 88.3639 };
const call = <T,>(h: (r: Request, c: T) => Promise<Response> | Response, r: Request, c?: T) => h(r, c as T);

let user: string;
let admin: string;

beforeEach(async () => {
  await freshDb();
  user = await register(authRegister.POST);
  admin = await register(authRegister.POST, "admin@example.com", "Admin");
});

describe("GET pandals", () => {
  it("lists approved pandals with search and filters", async () => {
    const all = await (await call(pandalsList.GET, req("/api/pandals?limit=500"))).json();
    expect(all.total).toBe(48);
    const q = await (await call(pandalsList.GET, req("/api/pandals?q=Deshapriya"))).json();
    expect(q.data.map((p: { name: string }) => p.name)).toContain("Deshapriya Park");
    const z = await (await call(pandalsList.GET, req("/api/pandals?zone=South-West"))).json();
    expect(z.data.every((p: { zone: string }) => p.zone === "South-West")).toBe(true);
  });

  it("does not invent ratings", async () => {
    const { data } = await (await call(pandalsList.GET, req("/api/pandals?limit=5"))).json();
    for (const p of data) {
      expect(p.rating).toBeNull();
      expect(p.reviewCount).toBe(0);
    }
  });

  it("marks curated entries verified and directory entries as community", async () => {
    const a = await (await call(pandalOne.GET, req("/api/pandals/p-bagbazar"), params({ id: "p-bagbazar" }))).json();
    const b = await (await call(pandalOne.GET, req("/api/pandals/p-sreebhumi-sporting-club"), params({ id: "p-sreebhumi-sporting-club" }))).json();
    expect(a.data.trust).toBe("VERIFIED");
    expect(b.data.trust).toBe("COMMUNITY");
  });

  it("404s for unknown ids and rejects bad query params", async () => {
    const r = await call(pandalOne.GET, req("/api/pandals/nope"), params({ id: "nope" }));
    expect(r.status).toBe(404);
    expect((await call(pandalsList.GET, req("/api/pandals?limit=999999"))).status).toBe(400);
    expect((await call(pandalsList.GET, req("/api/pandals?sort=DROP"))).status).toBe(400);
  });

  it("is safe against SQL injection in search", async () => {
    const r = await call(pandalsList.GET, req(`/api/pandals?q=${encodeURIComponent("'; DROP TABLE pandals;--")}`));
    expect(r.status).toBe(200);
    expect(await getDb().prepare("SELECT COUNT(*) c FROM pandals").get()).toEqual({ c: 48 });
  });
});

describe("GET nearby", () => {
  it("returns pandals within radius sorted by distance with distanceMeters", async () => {
    const r = await (await call(pandalsNearby.GET, req(`/api/pandals/nearby?lat=${KOLKATA.lat}&lng=${KOLKATA.lng}&radius=2000`))).json();
    expect(r.data.length).toBeGreaterThan(0);
    const d = r.data.map((p: { distanceMeters: number }) => p.distanceMeters);
    expect(d.every((x: number) => x <= 2000)).toBe(true);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
  });

  it("returns nearby food", async () => {
    const r = await (await call(foodNearby.GET, req(`/api/food/nearby?lat=22.5645&lng=88.3522&radius=2000`))).json();
    expect(r.data.length).toBeGreaterThan(0);
    expect(r.data[0].distanceMeters).toBeLessThanOrEqual(2000);
  });

  it("rejects invalid coordinates and radius", async () => {
    expect((await call(pandalsNearby.GET, req("/api/pandals/nearby?lat=100&lng=88&radius=1000"))).status).toBe(400);
    expect((await call(pandalsNearby.GET, req("/api/pandals/nearby?lat=22&lng=88&radius=99999999"))).status).toBe(400);
    expect((await call(pandalsNearby.GET, req("/api/pandals/nearby?lat=abc&lng=88"))).status).toBe(400);
  });
});

describe("auth & permissions", () => {
  it("requires authentication for every submission endpoint", async () => {
    const body = { name: "New Pandal", latitude: 22.57, longitude: 88.36 };
    expect((await call(pandalSubmit.POST, req("/api/pandals/submissions", { body }))).status).toBe(401);
    expect((await call(foodList.POST, req("/api/food", { body }))).status).toBe(401);
    expect((await call(pandalReviews.POST, req("/api/pandals/p-bagbazar/reviews", { body: { rating: 5 } }), params({ id: "p-bagbazar" }))).status).toBe(401);
    expect((await call(foodRecommend.POST, req("/api/food/f-golbari/recommend", { body: { rating: 5 } }), params({ id: "f-golbari" }))).status).toBe(401);
    expect((await call(reports.POST, req("/api/reports", { body: { entityType: "PANDAL", entityId: "p-bagbazar", reason: "SPAM" } }))).status).toBe(401);
    expect((await call(pandalSave.POST, req("/api/pandals/p-bagbazar/save", { method: "POST" }), params({ id: "p-bagbazar" }))).status).toBe(401);
  });

  it("blocks non-admins from moderation", async () => {
    expect((await call(adminQueue.GET, req("/api/admin/queue"))).status).toBe(401);
    expect((await call(adminQueue.GET, req("/api/admin/queue", { cookie: user }))).status).toBe(403);
    expect((await call(adminQueue.GET, req("/api/admin/queue", { cookie: admin }))).status).toBe(200);
  });

  it("rejects wrong passwords and duplicate registration", async () => {
    const bad = await call(authLogin.POST, req("/api/auth/login", { body: { email: "user@example.com", password: "wrongpass1" } }));
    expect(bad.status).toBe(401);
    const dupe = await call(authRegister.POST, req("/api/auth/register", { body: { email: "user@example.com", name: "x", password: "password123" } }));
    expect(dupe.status).toBe(409);
  });

  it("rejects cross-origin mutating requests (CSRF)", async () => {
    const r = await call(
      pandalSave.POST,
      req("/api/pandals/p-bagbazar/save", { method: "POST", cookie: user, headers: { origin: "https://evil.example" } }),
      params({ id: "p-bagbazar" })
    );
    expect(r.status).toBe(403);
  });

  it("rate limits repeated login attempts", async () => {
    let last = 200;
    for (let i = 0; i < 12; i++) {
      last = (await call(authLogin.POST, req("/api/auth/login", { body: { email: "a@b.co", password: "nopenope1" } }))).status;
    }
    expect(last).toBe(429);
  });
});

describe("save / visited", () => {
  it("toggles saved and visited", async () => {
    const p = params({ id: "p-bagbazar" });
    expect((await call(pandalSave.POST, req("/x", { method: "POST", cookie: user }), p)).status).toBe(200);
    expect(await getDb().prepare("SELECT COUNT(*) c FROM saved_pandals").get()).toEqual({ c: 1 });
    await call(pandalSave.DELETE, req("/x", { method: "DELETE", cookie: user }), p);
    expect(await getDb().prepare("SELECT COUNT(*) c FROM saved_pandals").get()).toEqual({ c: 0 });
    await call(pandalVisited.POST, req("/x", { method: "POST", cookie: user }), p);
    expect(await getDb().prepare("SELECT COUNT(*) c FROM visited_pandals").get()).toEqual({ c: 1 });
  });

  it("404s saving a nonexistent pandal", async () => {
    const r = await call(pandalSave.POST, req("/x", { method: "POST", cookie: user }), params({ id: "missing" }));
    expect(r.status).toBe(404);
  });
});

describe("POST pandal submission -> moderation", () => {
  const body = { name: "Brand New Sarbojanin", latitude: 22.6, longitude: 88.4, address: "Somewhere, Kolkata" };

  it("stays hidden until an admin approves, then appears on the map", async () => {
    const created = await call(pandalSubmit.POST, req("/api/pandals/submissions", { body, cookie: user }));
    expect(created.status).toBe(201);
    const { data } = await created.json();
    expect(data.status).toBe("PENDING");

    const hidden = await call(pandalOne.GET, req("/x"), params({ id: data.id }));
    expect(hidden.status).toBe(404);
    const list = await (await call(pandalsList.GET, req("/api/pandals?q=Brand%20New"))).json();
    expect(list.total).toBe(0);

    const queue = await (await call(adminQueue.GET, req("/x", { cookie: admin }))).json();
    expect(queue.pendingPandals.map((p: { id: string }) => p.id)).toContain(data.id);

    const ok = await call(adminPandal.PATCH, req("/x", { method: "PATCH", body: { action: "approve" }, cookie: admin }), params({ id: data.id }));
    expect(ok.status).toBe(200);

    const pub = await (await call(pandalOne.GET, req("/x"), params({ id: data.id }))).json();
    expect(pub.data.trust).toBe("COMMUNITY");
    expect(pub.data.verified).toBe(false);
  });

  it("flags near-duplicates unless forced", async () => {
    const r = await call(pandalSubmit.POST, req("/x", { body: { name: "Suruchi Sangha", latitude: 22.4907, longitude: 88.355 }, cookie: user }));
    expect(r.status).toBe(409);
    const j = await r.json();
    expect(j.error.code).toBe("POSSIBLE_DUPLICATE");
    expect(j.duplicates[0].id).toBe("p-suruchi-sangha");
    const forced = await call(pandalSubmit.POST, req("/x", { body: { name: "Suruchi Sangha", latitude: 22.4907, longitude: 88.355, force: true }, cookie: user }));
    expect(forced.status).toBe(201);
  });

  it("rejects invalid or out-of-area coordinates", async () => {
    expect((await call(pandalSubmit.POST, req("/x", { body: { name: "Delhi Pandal", latitude: 28.6, longitude: 77.2 }, cookie: user }))).status).toBe(400);
    expect((await call(pandalSubmit.POST, req("/x", { body: { name: "Bad", latitude: 999, longitude: 88 }, cookie: user }))).status).toBe(400);
  });

  it("stores rejection notes and keeps rejected content hidden", async () => {
    const { data } = await (await call(pandalSubmit.POST, req("/x", { body, cookie: user }))).json();
    await call(adminPandal.PATCH, req("/x", { method: "PATCH", body: { action: "reject", moderatorNotes: "Not a pandal" }, cookie: admin }), params({ id: data.id }));
    expect((await call(pandalOne.GET, req("/x"), params({ id: data.id }))).status).toBe(404);
    expect(await getDb().prepare("SELECT moderator_notes n, status s FROM pandals WHERE id = ?").get(data.id)).toEqual({ n: "Not a pandal", s: "REJECTED" });
  });

  it("lets only admins set photos on an existing pandal without changing its status", async () => {
    const edit = (cookie: string, images: string[]) =>
      call(adminPandal.PATCH, req("/x", { method: "PATCH", body: { action: "edit", edits: { images } }, cookie }), params({ id: "p-bagbazar" }));
    expect((await edit(user, ["abcdef123456.webp"])).status).toBe(403);
    expect((await edit(admin, ["../evil.png"])).status).toBe(400);
    expect((await edit(admin, ["abcdef123456.webp"])).status).toBe(200);
    const { data } = await (await call(pandalOne.GET, req("/x"), params({ id: "p-bagbazar" }))).json();
    expect(data.images).toEqual(["abcdef123456.webp"]);
    expect(data.trust).toBe("VERIFIED");
  });

  it("merges a duplicate pandal into an existing one", async () => {
    const { data } = await (await call(pandalSubmit.POST, req("/x", { body, cookie: user }))).json();
    await call(adminPandal.PATCH, req("/x", { method: "PATCH", body: { action: "approve" }, cookie: admin }), params({ id: data.id }));
    await call(pandalSave.POST, req("/x", { method: "POST", cookie: user }), params({ id: data.id }));
    const r = await call(adminPandal.POST, req("/x", { body: { intoId: "p-bagbazar" }, cookie: admin }), params({ id: data.id }));
    expect(r.status).toBe(200);
    expect(await getDb().prepare("SELECT pandal_id p FROM saved_pandals").get()).toEqual({ p: "p-bagbazar" });
    expect(await getDb().prepare("SELECT COUNT(*) c FROM pandals WHERE id = ?").get(data.id)).toEqual({ c: 0 });
  });
});

describe("food recommendation flow", () => {
  it("new place + recommendation are moderated, then rating appears", async () => {
    const created = await call(
      foodList.POST,
      req("/api/food", {
        cookie: user,
        body: { name: "Kalika Mishti Bhandar", latitude: 22.5727, longitude: 88.364, category: "Sweets", recommendedDish: "Sandesh", rating: 5, comment: "Fresh", pandalIds: ["p-collegesquare"] },
      })
    );
    expect(created.status).toBe(201);
    const { data } = await created.json();

    expect((await (await call(foodList.GET, req("/api/food?q=Kalika"))).json()).total).toBe(0);
    const queue = await (await call(adminQueue.GET, req("/x", { cookie: admin }))).json();
    expect(queue.pendingFood.map((f: { id: string }) => f.id)).toContain(data.id);

    await call(adminFood.PATCH, req("/x", { method: "PATCH", body: { action: "approve" }, cookie: admin }), params({ id: data.id }));
    const rec = (await getDb().prepare("SELECT id FROM food_recommendations WHERE food_place_id = ?").get(data.id)) as { id: string };
    const before = await (await call(foodList.GET, req("/api/food?q=Kalika"))).json();
    expect(before.data[0].rating).toBeNull();
    expect(before.data[0].reviewCount).toBe(0);

    const ok = await call(adminContent.PATCH, req("/x", { method: "PATCH", body: { action: "approve" }, cookie: admin }), params({ kind: "recommendations", id: rec.id }));
    expect(ok.status).toBe(200);
    const after = await (await call(foodList.GET, req("/api/food?q=Kalika"))).json();
    expect(after.data[0].rating).toBe(5);
    expect(after.data[0].recommendedDish).toBe("Sandesh");

    const reviews = await (await call(foodReviews.GET, req("/x"), params({ id: data.id }))).json();
    expect(reviews.data).toHaveLength(1);
    expect(await getDb().prepare("SELECT COUNT(*) c FROM pandal_food_links WHERE pandal_id='p-collegesquare' AND food_place_id = ?").get(data.id)).toEqual({ c: 1 });
  });

  it("recommends an existing place and validates rating/pandal", async () => {
    const p = params({ id: "f-golbari" });
    expect((await call(foodRecommend.POST, req("/x", { body: { rating: 9 }, cookie: user }), p)).status).toBe(400);
    expect((await call(foodRecommend.POST, req("/x", { body: { rating: 4, pandalId: "ghost" }, cookie: user }), p)).status).toBe(400);
    expect((await call(foodRecommend.POST, req("/x", { body: {}, cookie: user }), p)).status).toBe(400);
    const ok = await call(foodRecommend.POST, req("/x", { body: { rating: 4, recommendedDish: "Kosha Mangsho", pandalId: "p-hatibagan" }, cookie: user }), p);
    expect(ok.status).toBe(201);
    expect((await call(foodRecommend.POST, req("/x", { body: { rating: 4 }, cookie: user }), params({ id: "nope" }))).status).toBe(404);
  });

  it("uses a tighter duplicate radius for food than pandals", async () => {
    const near = await call(foodList.POST, req("/x", { cookie: user, body: { name: "Golbari Kosha Mangsho", latitude: 22.6009, longitude: 88.379 } }));
    expect(near.status).toBe(409);
  });
});

describe("reviews", () => {
  it("POST review updates the average from real data", async () => {
    const p = params({ id: "p-bagbazar" });
    expect((await call(pandalReviews.POST, req("/x", { body: { rating: 4, comment: "Lovely" }, cookie: user }), p)).status).toBe(201);
    await call(pandalReviews.POST, req("/x", { body: { rating: 2 }, cookie: admin }), p);
    const one = await (await call(pandalOne.GET, req("/x"), p)).json();
    expect(one.data.rating).toBe(3);
    expect(one.data.reviewCount).toBe(2);
    expect((await call(pandalReviews.POST, req("/x", { body: { rating: 0 }, cookie: user }), p)).status).toBe(400);
  });
});

describe("POST routes", () => {
  it("returns an honestly-labelled estimate without a Google key", async () => {
    const r = await call(routes.POST, req("/api/routes", { body: { origin: KOLKATA, destination: { lat: 22.5958, lng: 88.4192 }, mode: "WALKING" } }));
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j.data.estimated).toBe(true);
    expect(j.data.distanceMeters).toBeGreaterThan(0);
    expect(j.data.durationSeconds).toBeGreaterThan(0);
  });
  it("refuses transit when unavailable and validates input", async () => {
    const t = await call(routes.POST, req("/api/routes", { body: { origin: KOLKATA, destination: KOLKATA, mode: "TRANSIT" } }));
    expect(t.status).toBe(422);
    expect((await call(routes.POST, req("/api/routes", { body: { origin: { lat: 999, lng: 0 }, destination: KOLKATA } }))).status).toBe(400);
    expect((await call(routes.POST, req("/api/routes", { body: { origin: KOLKATA } }))).status).toBe(400);
  });
  it("optimizes only when asked and returns legs", async () => {
    const stops = [
      { id: "a", lat: 22.5, lng: 88.3 },
      { id: "b", lat: 22.9, lng: 88.7 },
      { id: "c", lat: 22.51, lng: 88.31 },
    ];
    const r = await (await call(optimize.POST, req("/x", { body: { origin: KOLKATA, stops, travelMode: "WALKING" } }))).json();
    expect(r.data.orderedStops).toHaveLength(3);
    expect(r.data.legs).toHaveLength(3);
    expect(r.data.totalDistance).toBeGreaterThan(0);
  });
});

describe("uploads (security)", () => {
  const upload = (buf: Buffer, name: string, type: string, cookie?: string) => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(buf)], name, { type }));
    return new Request("http://localhost:3000/api/uploads", { method: "POST", headers: { host: "localhost:3000", ...(cookie ? { cookie } : {}) }, body: form });
  };

  it("requires login", async () => {
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#f00" } }).png().toBuffer();
    expect((await call(uploads.POST, upload(png, "a.png", "image/png"))).status).toBe(401);
  });
  it("accepts a real image and re-encodes it to webp", async () => {
    const png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#0f0" } }).png().toBuffer();
    const r = await call(uploads.POST, upload(png, "photo.png", "image/png", user));
    expect(r.status).toBe(201);
    const j = await r.json();
    expect(j.data.name).toMatch(/\.webp$/);
  });
  it("rejects scripts disguised as images and non-images", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect((await call(uploads.POST, upload(svg, "x.png", "image/png", user))).status).toBe(415);
    expect((await call(uploads.POST, upload(Buffer.from("<?php echo 1;"), "shell.php", "image/jpeg", user))).status).toBe(415);
    expect((await call(uploads.POST, upload(Buffer.alloc(0), "e.png", "image/png", user))).status).toBe(400);
  });
  it("rejects oversized files", async () => {
    const r = await call(uploads.POST, upload(Buffer.alloc(9 * 1024 * 1024, 1), "big.png", "image/png", user));
    expect(r.status).toBe(413);
  });
});

describe("reports, plans, search", () => {
  it("stores reports and surfaces them in the admin queue", async () => {
    const r = await call(reports.POST, req("/x", { body: { entityType: "PANDAL", entityId: "p-bagbazar", reason: "WRONG_LOCATION" }, cookie: user }));
    expect(r.status).toBe(201);
    const q = await (await call(adminQueue.GET, req("/x", { cookie: admin }))).json();
    expect(q.reportedContent[0].entityLabel).toBe("Bagbazar Sarbojanin");
    expect((await call(reports.POST, req("/x", { body: { entityType: "PANDAL", entityId: "ghost", reason: "SPAM" }, cookie: user }))).status).toBe(404);
  });

  it("creates, reads and updates a plan mixing pandals and food", async () => {
    const created = await call(plans.POST, req("/x", { cookie: user, body: { name: "My route", travelMode: "WALKING", stops: [{ type: "PANDAL", id: "p-bagbazar" }, { type: "FOOD", id: "f-golbari" }, { type: "PANDAL", id: "p-hatibagan" }] } }));
    expect(created.status).toBe(201);
    const plan = (await created.json()).data;
    expect(plan.stops.map((s: { id: string }) => s.id)).toEqual(["p-bagbazar", "f-golbari", "p-hatibagan"]);
    const list = await (await call(plans.GET, req("/x", { cookie: user }))).json();
    expect(list.data).toHaveLength(1);
    expect((await call(plans.GET, req("/x", { cookie: admin }))).status).toBe(200);
    expect((await (await call(plans.GET, req("/x", { cookie: admin }))).json()).data).toHaveLength(0);
    expect((await call(plans.POST, req("/x", { cookie: user, body: { name: "bad", stops: [{ type: "PANDAL", id: "ghost" }] } }))).status).toBe(400);
  });

  it("searches grouped results", async () => {
    const r = await (await call(search.GET, req("/api/search?q=Ballygunge"))).json();
    expect(r.pandals.length).toBeGreaterThan(0);
    const m = await (await call(search.GET, req("/api/search?q=Kalighat"))).json();
    expect(m.transport.map((t: { name: string }) => t.name)).toContain("Kalighat");
    expect(Object.keys(m).sort()).toEqual(["areas", "food", "pandals", "transport"]);
  });
});


describe("GET /api/auth/me", () => {
  it("returns null when signed out and the real user when signed in", async () => {
    expect(await (await call(authMe.GET, req("/api/auth/me"))).json()).toEqual({ user: null });
    const { user: me } = await (await call(authMe.GET, req("/api/auth/me", { cookie: user }))).json();
    expect(me).toMatchObject({ email: "user@example.com", role: "USER" });
  });
});

describe("Gemini assistant", () => {
  const ask = (cookie: string | undefined, messages: unknown) =>
    call(assistant.POST, req("/api/assistant", { body: { messages }, cookie }));
  const gemini = (parts: unknown[]) => new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts } }] }), { status: 200 });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });

  it("requires sign-in and validates input", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    expect((await ask(undefined, [{ role: "user", text: "hi" }])).status).toBe(401);
    expect((await ask(user, [])).status).toBe(400);
    expect((await ask(user, [{ role: "model", text: "hi" }])).status).toBe(400);
  });

  it("is disabled without an API key", async () => {
    expect((await ask(user, [{ role: "user", text: "hi" }])).status).toBe(503);
    expect(await (await call(assistant.GET, req("/api/assistant"))).json()).toEqual({ enabled: false });
  });

  it("runs the tool loop over real data and drops made-up stop ids", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const bodies: { contents: { role: string; parts: { functionResponse?: { response: { result: unknown } } }[] }[] }[] = [];
    const replies = [
      gemini([{ functionCall: { name: "search_pandals", args: { query: "Bagbazar" } } }]),
      gemini([{ functionCall: { name: "propose_route", args: { title: "North trip", stops: [{ type: "PANDAL", id: "p-bagbazar", note: "Classic" }, { type: "PANDAL", id: "p-invented" }] } } }]),
      gemini([{ text: "Start at Bagbazar." }]),
    ];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return replies.shift()!;
    }));

    const res = await ask(user, [{ role: "user", text: "Plan North Kolkata" }]);
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.reply).toBe("Start at Bagbazar.");
    expect(data.stops.map((s: { id: string }) => s.id)).toEqual(["p-bagbazar"]);
    expect(data.stops[0].name).toBeTruthy();

    const toolResult = bodies[1].contents.at(-1)!.parts[0].functionResponse!.response.result as { pandals: { id: string }[] };
    expect(toolResult.pandals.some((p) => p.id === "p-bagbazar")).toBe(true);
  });

  it("maps Gemini rate limits to a friendly 429", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    const res = await ask(user, [{ role: "user", text: "hi" }]);
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("ASSISTANT_BUSY");
  });
});
