import { getDb } from "@/server/db";
import { ApiError, handle, json, limit, readJson } from "@/server/http";
import { createSession, isAdminEmail, sessionCookie, verifyPassword } from "@/server/auth";
import { loginSchema } from "@/server/validation";

export const POST = handle(async (req) => {
  limit(req, "login", 10);
  const body = loginSchema.parse(await readJson(req));
  const row = (await getDb()
    .prepare("SELECT id,email,name,role,password_hash FROM users WHERE email = ?")
    .get(body.email)) as { id: string; email: string; name: string; role: string; password_hash: string } | undefined;
  const ok = row ? await verifyPassword(body.password, row.password_hash) : false;
  if (!row || !ok) throw new ApiError(401, "BAD_CREDENTIALS", "Incorrect email or password.");
  const role = row.role === "ADMIN" || isAdminEmail(row.email) ? "ADMIN" : "USER";
  const { token, expires } = await createSession(row.id);
  return json(
    { user: { id: row.id, email: row.email, name: row.name, role } },
    { headers: { "Set-Cookie": sessionCookie(token, expires) } }
  );
});
