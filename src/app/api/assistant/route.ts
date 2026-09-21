import { handle, json, limit, readJson, rateLimit } from "@/server/http";
import { requireUser } from "@/server/auth";
import { askAssistant } from "@/server/gemini";
import { assistantSchema } from "@/server/validation";

export const maxDuration = 60;

export const GET = handle(async () => json({ enabled: Boolean(process.env.GEMINI_API_KEY) }));

export const POST = handle(async (req) => {
  const user = await requireUser(req);
  limit(req, "assistant-ip", 30, 3_600_000);
  rateLimit(`assistant-user:${user.id}`, 20, 3_600_000);
  const { messages } = assistantSchema.parse(await readJson(req));
  return json({ data: await askAssistant(messages) });
});
