/**
 * Luciteria Collector Cabinet — Avatar storage (server-only)
 *
 * Persists collector avatar images. In production (and any environment where
 * a Vercel Blob token is configured) images are uploaded to Vercel Blob, whose
 * URLs are permanent and survive redeploys. When no Blob token is present
 * (e.g. local development) it falls back to writing into `public/avatars/`.
 *
 * Vercel automatically injects `BLOB_READ_WRITE_TOKEN` into the runtime once a
 * Blob store is connected to the project, so no code change is needed to go
 * live — just create the store and connect it.
 */
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const AVATAR_EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Save an avatar image and return its public URL.
 *
 * @param {Buffer} buffer      raw image bytes
 * @param {string} ext         file extension (jpg|png|webp)
 * @param {string} contentType MIME type
 * @returns {Promise<string>}  publicly reachable URL/path for the image
 */
export async function saveAvatar(buffer, ext, contentType) {
  const filename = `${uuidv4()}.${ext}`;

  if (hasBlobToken()) {
    // Dynamic import so the dependency is only loaded when actually used.
    const { put } = await import("@vercel/blob");
    const blob = await put(`avatars/${filename}`, buffer, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return blob.url;
  }

  // Local-development fallback: write to public/avatars/.
  const dir = path.join(process.cwd(), "public", "avatars");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/avatars/${filename}`;
}
