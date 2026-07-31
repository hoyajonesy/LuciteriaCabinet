/**
 * Regression tests — Bug 2: Collection Passport avatar upload.
 *
 * Root cause: on Vercel (read-only, ephemeral FS) with no BLOB_READ_WRITE_TOKEN,
 * saveAvatar fell back to a local file write that threw, surfacing the opaque
 * "Could not save the avatar" error and never persisting anything.
 *
 * Covers: valid JPEG/PNG upload, >2MB rejection, unsupported type rejection,
 * DB persistence (persist called with the stored URL), removal/reset, and the
 * storage-misconfiguration path.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { applyAvatarChange, saveAvatar, AVATAR_MAX_BYTES } from "../app/lib/avatar.server.js";

/** Build a multipart FormData carrying an avatar file + intent. */
function uploadForm(bytes, type, name = "avatar.bin") {
  const fd = new FormData();
  fd.set("intent", "upload-avatar");
  fd.set("avatar", new File([bytes], name, { type }));
  return fd;
}

function capturerPersist() {
  const calls = [];
  const persist = async (url) => { calls.push(url); };
  return { persist, calls };
}

test("valid JPEG upload is stored and persisted to User.avatarUrl", async () => {
  const { persist, calls } = capturerPersist();
  const storedUrl = "/avatars/photo-abc123.jpg";
  const save = async () => storedUrl;
  const res = await applyAvatarChange(uploadForm(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg", "photo.jpg"), { persist, save });
  assert.equal(res.status, 200);
  assert.equal(res.body.avatarOk, true);
  assert.equal(res.body.avatarUrl, storedUrl);
  assert.deepEqual(calls, [storedUrl]); // DB persistence to User.avatarUrl
});

test("valid PNG upload is accepted", async () => {
  const { persist, calls } = capturerPersist();
  const storedUrl = "/avatars/photo-def456.png";
  const save = async () => storedUrl;
  const res = await applyAvatarChange(uploadForm(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png", "photo.png"), { persist, save });
  assert.equal(res.status, 200);
  assert.equal(res.body.avatarUrl, storedUrl);
  assert.deepEqual(calls, [storedUrl]);
});

test("valid WebP upload is accepted", async () => {
  const { persist } = capturerPersist();
  const save = async () => "/avatars/photo-ghi789.webp";
  const res = await applyAvatarChange(uploadForm(Buffer.from([0x52, 0x49, 0x46, 0x46]), "image/webp", "photo.webp"), { persist, save });
  assert.equal(res.status, 200);
});

test("files larger than 2 MB are rejected server-side", async () => {
  const { persist, calls } = capturerPersist();
  let saveCalled = false;
  const save = async () => { saveCalled = true; return "nope"; };
  const big = Buffer.alloc(AVATAR_MAX_BYTES + 1, 1);
  const res = await applyAvatarChange(uploadForm(big, "image/png", "big.png"), { persist, save });
  assert.equal(res.status, 400);
  assert.match(res.body.avatarError, /2 MB or smaller/);
  assert.equal(saveCalled, false, "storage must not be touched for oversized files");
  assert.deepEqual(calls, [], "nothing persisted for oversized files");
});

test("unsupported file types are rejected server-side", async () => {
  const { persist } = capturerPersist();
  const save = async () => "nope";
  const res = await applyAvatarChange(uploadForm(Buffer.from([0x47]), "image/gif", "anim.gif"), { persist, save });
  assert.equal(res.status, 400);
  assert.match(res.body.avatarError, /JPG, PNG, or WebP/);
});

test("missing/empty file is rejected", async () => {
  const { persist } = capturerPersist();
  const fd = new FormData();
  fd.set("intent", "upload-avatar");
  const res = await applyAvatarChange(fd, { persist, save: async () => "x" });
  assert.equal(res.status, 400);
  assert.match(res.body.avatarError, /choose an image/i);
});

test("remove-avatar resets User.avatarUrl to null (Luciteria default)", async () => {
  const { persist, calls } = capturerPersist();
  const fd = new FormData();
  fd.set("intent", "remove-avatar");
  const res = await applyAvatarChange(fd, { persist });
  assert.equal(res.status, 200);
  assert.equal(res.body.avatarOk, true);
  assert.match(res.body.message, /removed/i);
  assert.deepEqual(calls, [null]);
});

test("storage misconfiguration surfaces a clear (non-retry) message", async () => {
  const { persist } = capturerPersist();
  const save = async () => { throw new Error("Avatar storage is not configured: BLOB_READ_WRITE_TOKEN is missing."); };
  const res = await applyAvatarChange(uploadForm(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg"), { persist, save });
  assert.equal(res.status, 500);
  assert.match(res.body.avatarError, /storage is not configured/i);
});

test("generic storage failure returns the retry message", async () => {
  const { persist } = capturerPersist();
  const save = async () => { throw new Error("network blip"); };
  const res = await applyAvatarChange(uploadForm(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg"), { persist, save });
  assert.equal(res.status, 500);
  assert.match(res.body.avatarError, /Please try again/);
});

// ── saveAvatar storage-selection behaviour ──────────────────────────────

test("saveAvatar refuses to write to the ephemeral FS in production without a Blob token", async () => {
  const prevVercel = process.env.VERCEL;
  const prevToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.VERCEL = "1";
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    await assert.rejects(
      () => saveAvatar(Buffer.from([1, 2, 3]), "png", "image/png"),
      /BLOB_READ_WRITE_TOKEN/
    );
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = prevVercel;
    if (prevToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = prevToken;
  }
});

test("saveAvatar writes to public/avatars in local development (no token, not serverless)", async () => {
  const prevVercel = process.env.VERCEL;
  const prevNode = process.env.NODE_ENV;
  const prevToken = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL;
  process.env.NODE_ENV = "development";
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    const url = await saveAvatar(Buffer.from([1, 2, 3]), "png", "image/png");
    assert.match(url, /^\/avatars\/.+\.png$/);
    const filePath = path.join(process.cwd(), "public", url);
    assert.ok(fs.existsSync(filePath), "file should be written locally");
    fs.unlinkSync(filePath); // cleanup
  } finally {
    if (prevVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = prevVercel;
    if (prevNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevNode;
    if (prevToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = prevToken;
  }
});
