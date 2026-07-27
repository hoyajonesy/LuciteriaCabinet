/**
 * Collector Profile — /app/cabinet/profile  (private)
 *
 * Account-level identity fields used across the Collection Passport:
 * display name, handle, avatar, bio, location, favourite element, and
 * collection motivation. This page is a prerequisite for publishing a
 * Passport. Gated behind the `feature_collection_passport` feature flag.
 */
import { json, redirect, unstable_parseMultipartFormData, unstable_createMemoryUploadHandler } from "@remix-run/node";
import { useLoaderData, useActionData, Form, Link, useNavigation } from "@remix-run/react";
import { useState, useRef, useEffect } from "react";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import AppNav from "../components/AppNav";
import Toast from "../components/Toast";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import { requireNotFrozen } from "../lib/frozen-guard.server";
import { getFeatureFlag } from "../lib/feature-flags.server";
import { getUnreadCount } from "../lib/notifications-db.server";
import { ELEMENTS_118 } from "../data/elements.server";
import {
  getOrCreatePassport,
  updateProfile,
  generateDisplayName,
  BIO_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
} from "../lib/passport.server";

const PASSPORT_FLAG = "feature_collection_passport";
const MOTIVATIONS = [
  { value: "", label: "— Not set —" },
  { value: "INVENTORY", label: "Inventory — keeping track of what I own" },
  { value: "SOCIAL", label: "Social — sharing with fellow collectors" },
  { value: "ACQUISITION", label: "Acquisition — hunting new elements" },
  { value: "INVESTMENT", label: "Investment — long-term value" },
  { value: "DISCOVERY", label: "Discovery — learning about the elements" },
];

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");

  const flagEnabled = await getFeatureFlag(PASSPORT_FLAG);
  if (!flagEnabled) return json({ comingSoon: true });

  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");

  // Ensure handle + display name defaults exist for every account.
  await getOrCreatePassport(userId);
  const user = await getUserById(userId);
  const unreadCount = await getUnreadCount(userId);

  const elements = ELEMENTS_118.map((e) => ({ sym: e.sym, name: e.name, z: e.z }));

  return json({
    comingSoon: false,
    firstName: user.firstName || "Collector",
    unreadCount,
    profile: {
      handle: user.handle || "",
      displayName: user.displayName || generateDisplayName(user),
      bio: user.bio || "",
      location: user.location || "",
      favouriteElement: user.favouriteElement || "",
      primaryMotivation: user.primaryMotivation || "",
      avatarUrl: user.avatarUrl || "",
    },
    elements,
    limits: {
      bio: BIO_MAX_LENGTH,
      location: LOCATION_MAX_LENGTH,
      displayName: DISPLAY_NAME_MAX_LENGTH,
    },
  });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });
  await requireNotFrozen(userId);

  const flagEnabled = await getFeatureFlag(PASSPORT_FLAG);
  if (!flagEnabled) return json({ error: "This feature is not available yet." }, { status: 403 });

  // Parse multipart form so the avatar file (if any) can be handled.
  const uploadHandler = unstable_createMemoryUploadHandler({ maxPartSize: AVATAR_MAX_BYTES + 1024 });
  let form;
  try {
    form = await unstable_parseMultipartFormData(request, uploadHandler);
  } catch (err) {
    return json({ error: "Upload failed — the file may be too large (max 2 MB)." }, { status: 400 });
  }

  const intent = form.get("intent");

  if (intent === "remove-avatar") {
    await updateProfile(userId, { avatarUrl: null });
    return json({ ok: true, message: "Avatar removed." });
  }

  // Handle avatar upload (optional).
  let avatarUrl;
  const file = form.get("avatar");
  if (file && typeof file === "object" && typeof file.arrayBuffer === "function" && file.size > 0) {
    const ext = AVATAR_EXT_BY_MIME[file.type];
    if (!ext) {
      return json({ error: "Avatar must be a JPG, PNG, or WebP image." }, { status: 400 });
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return json({ error: "Avatar must be 2 MB or smaller." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${uuidv4()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "avatars");
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), buffer);
      avatarUrl = `/avatars/${filename}`;
    } catch (err) {
      console.error("[Profile] avatar write failed:", err);
      return json({ error: "Could not save the avatar. Please try again." }, { status: 500 });
    }
  }

  const fields = {
    displayName: form.get("displayName"),
    handle: form.get("handle"),
    bio: form.get("bio"),
    location: form.get("location"),
    favouriteElement: form.get("favouriteElement"),
    primaryMotivation: form.get("primaryMotivation"),
  };
  if (avatarUrl !== undefined) fields.avatarUrl = avatarUrl;

  const { error } = await updateProfile(userId, fields);
  if (error) return json({ error }, { status: 400 });

  return json({ ok: true, message: "Profile saved." });
};

function ComingSoon() {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <AppNav mode="customer" customerName="Collector" currentPath="/app/cabinet/profile" />
      <main className="luc-main flex-1 flex items-center justify-center px-8 py-8">
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-id-card text-gray-400 text-xl" />
          </div>
          <h1 className="luc-heading text-xl font-medium mb-2">Collection Passport is coming soon</h1>
          <p className="text-sm text-gray-500">
            Your shareable collector profile isn't available just yet. Check back soon!
          </p>
        </div>
      </main>
    </div>
  );
}

export default function ProfilePage() {
  const data = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [toast, setToast] = useState(null);

  if (data.comingSoon) return <ComingSoon />;

  const { profile, elements, limits, firstName, unreadCount } = data;
  const [bio, setBio] = useState(profile.bio);
  const [preview, setPreview] = useState(profile.avatarUrl || "/images/default-avatar.svg");
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);
  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData?.message) setToast({ message: actionData.message, type: "success" });
    else if (actionData?.error) setToast({ message: actionData.error, type: "error" });
  }, [actionData]);

  const handleFileChange = (e) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(profile.avatarUrl || "/images/default-avatar.svg");
      return;
    }
    const okTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!okTypes.includes(file.type)) {
      setFileError("Please choose a JPG, PNG, or WebP image.");
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileError("Image must be 2 MB or smaller.");
      e.target.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AppNav mode="customer" customerName={firstName} currentPath="/app/cabinet/profile" unreadCount={unreadCount} />
      <main className="luc-main flex-1">
        <div className="max-w-[820px] mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="luc-heading text-2xl font-medium">Collector Profile</h1>
              <p className="text-sm text-gray-500 mt-1">
                This information appears on your public Collection Passport.
              </p>
            </div>
            <Link
              to="/app/cabinet/passport"
              className="text-sm border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
              style={{ textDecoration: "none" }}
            >
              <i className="fa-solid fa-id-card mr-2" />My Passport
            </Link>
          </div>

          <Form method="post" encType="multipart/form-data" className="space-y-6">
            {/* Avatar */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="luc-heading text-sm font-medium mb-4">Avatar</h2>
              <div className="flex items-center gap-5">
                <img
                  src={preview}
                  alt="Avatar preview"
                  className="w-20 h-20 rounded-full object-cover border border-gray-300 bg-gray-100"
                />
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    name="avatar"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="block text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:bg-white file:text-gray-700 file:text-sm hover:file:bg-gray-50"
                  />
                  <p className="text-xs text-gray-400 mt-2">JPG, PNG or WebP. Max 2 MB.</p>
                  {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
                  {profile.avatarUrl && (
                    <button
                      type="submit"
                      name="intent"
                      value="remove-avatar"
                      className="text-xs text-gray-500 hover:text-gray-700 underline mt-2"
                    >
                      Remove avatar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Identity */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
              <h2 className="luc-heading text-sm font-medium">Identity</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  name="displayName"
                  defaultValue={profile.displayName}
                  maxLength={limits.displayName}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-luc-blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Handle</label>
                <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                  <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-300">
                    cabinet.luciteria.com/p/
                  </span>
                  <input
                    type="text"
                    name="handle"
                    defaultValue={profile.handle}
                    className="flex-1 text-sm px-3 py-2 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Lowercase letters, numbers and hyphens only. Changing this after publishing breaks your old link.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio <span className="text-gray-400 font-normal">({bio.length}/{limits.bio})</span>
                </label>
                <textarea
                  name="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, limits.bio))}
                  maxLength={limits.bio}
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-luc-blue"
                  placeholder="Tell fellow collectors a little about your collection…"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    name="location"
                    defaultValue={profile.location}
                    maxLength={limits.location}
                    placeholder="Bristol, UK"
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-luc-blue"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Favourite Element</label>
                  <select
                    name="favouriteElement"
                    defaultValue={profile.favouriteElement}
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-luc-blue"
                  >
                    <option value="">— None —</option>
                    {elements.map((el) => (
                      <option key={el.sym} value={el.sym}>
                        {el.name} ({el.sym})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collection Motivation</label>
                <select
                  name="primaryMotivation"
                  defaultValue={profile.primaryMotivation}
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-luc-blue"
                >
                  {MOTIVATIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end gap-3">
              <button
                type="submit"
                name="intent"
                value="save"
                disabled={isSubmitting}
                className="text-sm bg-luc-blue hover:bg-luc-blue-hover transition-colors text-white px-5 py-2.5 rounded-btn disabled:opacity-60"
              >
                <i className="fa-solid fa-floppy-disk mr-2" />
                {isSubmitting ? "Saving…" : "Save Profile"}
              </button>
            </div>
          </Form>
        </div>
      </main>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
