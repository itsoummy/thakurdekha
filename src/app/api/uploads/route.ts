import { ApiError, handle, json, limit } from "@/server/http";
import { requireUser } from "@/server/auth";
import { MAX_UPLOAD_BYTES, storeImage } from "@/server/storage";

export const POST = handle(async (req) => {
  await requireUser(req);
  limit(req, "upload", 20, 3_600_000);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_UPLOAD_BYTES + 100_000) throw new ApiError(413, "FILE_TOO_LARGE", "Images must be 8 MB or smaller.");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "BAD_FORM", "Upload must be multipart form data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "NO_FILE", "No file uploaded.");
  const name = await storeImage(Buffer.from(await file.arrayBuffer()));
  return json({ data: { name, url: `/api/uploads/${name}`, thumbUrl: `/api/uploads/${name.replace(".webp", ".thumb.webp")}` } }, { status: 201 });
});
