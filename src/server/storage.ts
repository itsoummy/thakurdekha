import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { head, put } from "@vercel/blob";
import { ApiError } from "./http";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp"]);

export interface ObjectStorage {
  put(name: string, data: Buffer): Promise<void>;
  get(name: string): Promise<Buffer | null>;
}

const dir = () => process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export const localStorage: ObjectStorage = {
  async put(name, data) {
    await fs.mkdir(/*turbopackIgnore: true*/ dir(), { recursive: true });
    await fs.writeFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir(), name), data);
  },
  async get(name) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return null;
    try {
      return await fs.readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir(), name));
    } catch {
      return null;
    }
  },
};

export const blobStorage: ObjectStorage = {
  async put(name, data) {
    await put(`uploads/${name}`, data, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "image/webp" });
  },
  async get(name) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return null;
    try {
      const meta = await head(`uploads/${name}`);
      const res = await fetch(meta.url);
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    } catch {
      return null;
    }
  },
};

export const defaultStorage = (): ObjectStorage => (process.env.BLOB_READ_WRITE_TOKEN ? blobStorage : localStorage);

/**
 * Validates by decoding (not by trusting filename or Content-Type), re-encodes to WebP,
 * strips EXIF/metadata, and stores a full-size and thumbnail copy.
 */
export async function storeImage(data: Buffer, storage: ObjectStorage = defaultStorage()): Promise<string> {
  if (data.length === 0) throw new ApiError(400, "EMPTY_FILE", "The uploaded file is empty.");
  if (data.length > MAX_UPLOAD_BYTES) throw new ApiError(413, "FILE_TOO_LARGE", "Images must be 8 MB or smaller.");
  let format: string | undefined;
  try {
    format = (await sharp(data, { limitInputPixels: 60_000_000 }).metadata()).format;
  } catch {
    throw new ApiError(415, "BAD_IMAGE", "That file isn't a valid image.");
  }
  if (!format || !ALLOWED.has(format)) {
    throw new ApiError(415, "BAD_IMAGE_TYPE", "Only JPEG, PNG or WebP images are allowed.");
  }
  const id = randomBytes(12).toString("base64url");
  const full = await sharp(data).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const thumb = await sharp(data).rotate().resize({ width: 400, height: 400, fit: "cover" }).webp({ quality: 70 }).toBuffer();
  await storage.put(`${id}.webp`, full);
  await storage.put(`${id}.thumb.webp`, thumb);
  return `${id}.webp`;
}
