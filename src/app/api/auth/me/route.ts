import { handle, json } from "@/server/http";
import { getUser } from "@/server/auth";

export const GET = handle(async (req) => json({ user: getUser(req) }, { cache: "private, no-store" }));
