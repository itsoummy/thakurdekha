import { getDb } from "@/server/db";
import { ApiError, handle, json, limit, readJson } from "@/server/http";
import { createSession, hashPassword, isAdminEmail, newUserId, sessionCookie } from "@/server/auth";
import { registerSchema } from "@/server/validation";

export const POST = handle(async (req) => {
  limit(req, "register", 10);
  const body = registerSchema.parse(await readJson(req));
  const db = getDb();
  if (await db.prepare("SELECT 1 FROM users WHERE email = ?").get(body.email)) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists.");
  }
  const id = newUserId();
  const role = isAdminEmail(body.email) ? "ADMIN" : "USER";
  await db.prepare("INSERT INTO users (id,email,name,password_hash,role) VALUES (?,?,?,?,?)").run(
    id,
    body.email,
    body.name,
    await hashPassword(body.password),
    role
  );
  const { token, expires } = await createSession(id);
  return json(
    { user: { id, email: body.email, name: body.name, role } },
    { status: 201, headers: { "Set-Cookie": sessionCookie(token, expires) } }
  );
});
