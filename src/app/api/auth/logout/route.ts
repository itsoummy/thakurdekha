import { handle, json } from "@/server/http";
import { clearCookie, destroySession } from "@/server/auth";

export const POST = handle(async (req) => {
  await destroySession(req);
  return json({ ok: true }, { headers: { "Set-Cookie": clearCookie() } });
});
