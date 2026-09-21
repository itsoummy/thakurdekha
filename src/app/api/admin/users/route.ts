import { handle, json } from "@/server/http";
import { requireAdmin, isAdminEmail } from "@/server/auth";
import { getDb } from "@/server/db";
import { adminListQuery } from "@/server/validation";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const q = adminListQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const esc = (q.q ?? "").split("\\").join("\\\\").split("%").join("\\%").split("_").join("\\_");
  const like = `%${esc}%`;
  const rows = await getDb()
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.created_at AS createdAt,
        (SELECT COUNT(*) FROM pandals p WHERE p.created_by = u.id) AS pandalSubmissions,
        (SELECT COUNT(*) FROM food_places f WHERE f.created_by = u.id) AS foodSubmissions,
        (SELECT COUNT(*) FROM pandal_reviews r WHERE r.user_id = u.id) AS reviews
       FROM users u WHERE u.email LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\'
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
    )
    .all(like, like, q.limit, q.offset);
  return json(
    {
      data: rows.map((r) => ({
        id: r.id as string,
        email: r.email as string,
        name: r.name as string,
        role: r.role === "ADMIN" || isAdminEmail(r.email as string) ? "ADMIN" : "USER",
        envAdmin: isAdminEmail(r.email as string),
        createdAt: r.createdAt as string,
        pandalSubmissions: Number(r.pandalSubmissions),
        foodSubmissions: Number(r.foodSubmissions),
        reviews: Number(r.reviews),
      })),
    },
    { cache: "private, no-store" }
  );
});
