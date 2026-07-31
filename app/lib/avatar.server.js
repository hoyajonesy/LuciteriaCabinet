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
 * True when running on a serverless/production host (e.g. Vercel) where the
 * application filesystem is read-only and ephemeral. Writing avatar files to
 * `public/avatars/` there either throws EROFS or is silently discarded on the
 * next deploy — so we must use a persistent store (Vercel Blob) instead.
 */
function isEphemeralFsHost() {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
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

  // No Blob token configured. On a serverless/production host the filesystem
  // is read-only and ephemeral, so falling back to a local file write would
  // fail (EROFS) or silently lose the avatar on the next deploy — which is
  // exactly what produced the opaque "Could not save the avatar" error.
  // Fail with an actionable message instead so the misconfiguration is clear.
  if (isEphemeralFsHost()) {
    throw new Error(
      "Avatar storage is not configured: BLOB_READ_WRITE_TOKEN is missing. " +
        "Connect a Vercel Blob store to the project so avatars persist across deploys."
    );
  }

  // Local-development fallback: write to public/avatars/.
  const dir = path.join(process.cwd(), "public", "avatars");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/avatars/${filename}`;
}

/**
 * Orchestrate an avatar upload/removal from a parsed multipart form.
 *
 * Pure of any session/DB coupling: storage (`save`) and DB persistence
 * (`persist`) are injected, so this can be unit-tested directly. Performs
 * server-side format + size validation (never trusting the client) and maps
 * storage-configuration failures to a clear message.
 *
 * @param {FormData} form                     parsed multipart form
 * @param {object}   deps
 * @param {Function} deps.persist             async (avatarUrl|null) => void — updates User.avatarUrl
 * @param {Function} [deps.save]              async (buffer, ext, contentType) => url
 * @returns {Promise<{status:number, body:object}>}
 */
export async function applyAvatarChange(form, { persist, save = saveAvatar } = {}) {
  if (typeof persist !== "function") {
    throw new Error("applyAvatarChange requires a persist(avatarUrl) function.");
  }

  const intent = form.get("intent");

  if (intent === "remove-avatar") {
    await persist(null);
    return { status: 200, body: { avatarOk: true, message: "Avatar removed." } };
  }

  // upload-avatar
  const file = form.get("avatar");
  if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function" || file.size === 0) {
    return { status: 400, body: { avatarError: "Please choose an image to upload." } };
  }
  const ext = AVATAR_EXT_BY_MIME[file.type];
  if (!ext) {
    return { status: 400, body: { avatarError: "Avatar must be a JPG, PNG, or WebP image." } };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { status: 400, body: { avatarError: "Avatar must be 2 MB or smaller." } };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const avatarUrl = await save(buffer, ext, file.type);
    await persist(avatarUrl);
    return { status: 200, body: { avatarOk: true, message: "Avatar updated.", avatarUrl } };
  } catch (err) {
    console.error("[Avatar] save failed:", err);
    // Surface a clearer message when the failure is a missing storage
    // configuration (rather than a transient error the user can retry).
    const isConfigError = /BLOB_READ_WRITE_TOKEN|not configured/i.test(err?.message || "");
    const avatarError = isConfigError
      ? "Avatar uploads are temporarily unavailable — storage is not configured. Please contact support."
      : "Could not save the avatar. Please try again.";
    return { status: 500, body: { avatarError } };
  }
}
