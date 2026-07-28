/**
 * Collection Passport manager — /app/cabinet/passport  (private)
 *
 * Lets a collector publish/unpublish their public Passport, curate up to
 * five featured elements, review their public collection stats, and grab
 * their shareable link. Gated behind the `feature_collection_passport`
 * feature flag.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, Link, useNavigation } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";
import AppNav from "../components/AppNav";
import Toast from "../components/Toast";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import { requireNotFrozen } from "../lib/frozen-guard.server";
import { getFeatureFlag } from "../lib/feature-flags.server";
import { getUnreadCount } from "../lib/notifications-db.server";
import {
  getOrCreatePassport,
  getCollectionStats,
  getOwnedElementsForPicker,
  resolveFeaturedElements,
  updateFeaturedElements,
  publishPassport,
  unpublishPassport,
  generateDisplayName,
  MAX_FEATURED_ELEMENTS,
} from "../lib/passport.server";

const PASSPORT_FLAG = "feature_collection_passport";
const PUBLIC_BASE = "https://cabinet.luciteria.com/p/";

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");

  const flagEnabled = await getFeatureFlag(PASSPORT_FLAG);
  if (!flagEnabled) return json({ comingSoon: true });

  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");

  const passport = await getOrCreatePassport(userId);
  const user = await getUserById(userId);
  const unreadCount = await getUnreadCount(userId);

  const [stats, ownedElements, featured] = await Promise.all([
    getCollectionStats(userId),
    getOwnedElementsForPicker(userId),
    resolveFeaturedElements(passport.featuredElements),
  ]);

  // Pre-select an element passed from the wishlist ("Feature on Passport").
  const url = new URL(request.url);
  const featureParam = url.searchParams.get("feature") || null;

  return json({
    comingSoon: false,
    firstName: user.firstName || "Collector",
    unreadCount,
    published: passport.published,
    publishedAt: passport.publishedAt,
    handle: user.handle || "",
    displayName: user.displayName || generateDisplayName(user),
    avatarUrl: user.avatarUrl || "",
    bio: user.bio || "",
    location: user.location || "",
    publicUrl: user.handle ? `${PUBLIC_BASE}${user.handle}` : null,
    stats,
    featured,
    ownedElements,
    featureParam,
    maxFeatured: MAX_FEATURED_ELEMENTS,
  });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });
  await requireNotFrozen(userId);

  const flagEnabled = await getFeatureFlag(PASSPORT_FLAG);
  if (!flagEnabled) return json({ error: "This feature is not available yet." }, { status: 403 });

  const form = await request.formData();
  const intent = form.get("intent");

  const passport = await getOrCreatePassport(userId);

  if (intent === "publish") {
    const user = await getUserById(userId);
    if (!user.handle) {
      return json({ error: "Set up your profile handle before publishing." }, { status: 400 });
    }
    await publishPassport(userId);
    return json({ ok: true, message: "Your Passport is now live!" });
  }

  if (intent === "unpublish") {
    await unpublishPassport(userId);
    return json({ ok: true, message: "Your Passport is now private." });
  }

  if (intent === "save-featured") {
    let elements = [];
    try {
      elements = JSON.parse(form.get("featured") || "[]");
    } catch (err) {
      return json({ error: "Could not read your selection. Please try again." }, { status: 400 });
    }
    const mapped = (Array.isArray(elements) ? elements : [])
      .slice(0, MAX_FEATURED_ELEMENTS)
      .map((e, i) => ({
        elementKey: e.symbol || e.elementKey,
        format: e.format || null,
        displayOrder: i + 1,
      }));
    await updateFeaturedElements(passport.id, mapped);
    return json({ ok: true, message: "Featured elements updated." });
  }

  return json({ error: "Unknown action." }, { status: 400 });
};

function ComingSoon() {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <AppNav mode="customer" customerName="Collector" currentPath="/app/cabinet/passport" />
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

export default function PassportPage() {
  const data = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [toast, setToast] = useState(null);

  if (data.comingSoon) return <ComingSoon />;

  const {
    firstName,
    unreadCount,
    published,
    handle,
    displayName,
    avatarUrl,
    bio,
    location,
    publicUrl,
    stats,
    featured,
    ownedElements,
    featureParam,
    maxFeatured,
  } = data;

  const isSubmitting = navigation.state === "submitting";

  // Featured-element working set (client-side until saved). Identity is the
  // element + format combination (uid), so the same element can appear in more
  // than one format.
  const [selected, setSelected] = useState(() =>
    featured.map((f) => ({
      uid: f.uid,
      symbol: f.symbol,
      name: f.name,
      atomicNumber: f.atomicNumber,
      format: f.format,
      formatName: f.formatName,
      imageUrl: f.imageUrl,
    }))
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (actionData?.message) setToast({ message: actionData.message, type: "success" });
    else if (actionData?.error) setToast({ message: actionData.error, type: "error" });
  }, [actionData]);

  // If arriving from the wishlist with ?feature=SYM, open the picker with it
  // pre-selected (only if owned and not already featured).
  useEffect(() => {
    if (!featureParam) return;
    const owned = ownedElements.find((o) => o.symbol === featureParam);
    if (!owned) return;
    setSelected((prev) => {
      if (prev.some((p) => p.uid === owned.uid)) return prev;
      if (prev.length >= maxFeatured) return prev;
      return [...prev, {
        uid: owned.uid,
        symbol: owned.symbol,
        name: owned.name,
        atomicNumber: owned.atomicNumber,
        format: owned.format,
        formatName: owned.formatName,
        imageUrl: owned.imageUrl,
      }];
    });
    setPickerOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureParam]);

  const selectedUids = useMemo(() => new Set(selected.map((s) => s.uid)), [selected]);

  const filteredOwned = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ownedElements;
    return ownedElements.filter(
      (o) => o.name.toLowerCase().includes(q) || o.symbol.toLowerCase().includes(q)
    );
  }, [ownedElements, search]);

  const toggleElement = (el) => {
    setSelected((prev) => {
      if (prev.some((p) => p.uid === el.uid)) {
        return prev.filter((p) => p.uid !== el.uid);
      }
      if (prev.length >= maxFeatured) return prev;
      return [...prev, {
        uid: el.uid,
        symbol: el.symbol,
        name: el.name,
        atomicNumber: el.atomicNumber,
        format: el.format,
        formatName: el.formatName,
        imageUrl: el.imageUrl,
      }];
    });
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setToast({ message: "Link copied to clipboard!", type: "success" });
    } catch (err) {
      setToast({ message: "Could not copy — please copy manually.", type: "error" });
    }
  };

  const shareText = `Check out my element collection on Luciteria Cabinet — ${stats.completionPercent}% of the periodic table so far!`;

  const nativeShare = async () => {
    if (!publicUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "My Collection Passport", text: shareText, url: publicUrl });
      } catch (err) {
        /* user cancelled */
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AppNav mode="customer" customerName={firstName} currentPath="/app/cabinet/passport" unreadCount={unreadCount} />
      <main className="luc-main flex-1">
        <div className="max-w-[900px] mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="luc-heading text-2xl font-medium">Collection Passport</h1>
              <p className="text-sm text-gray-500 mt-1">
                Your public collector profile — share your cabinet with the world.
              </p>
            </div>
            <Link
              to="/app/cabinet/profile"
              className="text-sm border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
              style={{ textDecoration: "none" }}
            >
              <i className="fa-solid fa-user-pen mr-2" />Edit Profile
            </Link>
          </div>

          {/* Status banner */}
          <div
            className={`rounded-lg border p-5 mb-6 ${
              published ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full ${
                    published ? "bg-green-600 text-white" : "bg-amber-500 text-white"
                  }`}
                >
                  <i className={`fa-solid ${published ? "fa-circle-check" : "fa-pen-ruler"}`} />
                  {published ? "Published" : "Draft"}
                </span>
                <p className="text-sm text-gray-700">
                  {published
                    ? "Your Passport is live and visible to anyone with the link."
                    : "Your Passport is private. Publish it to share your collection."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {published && publicUrl && (
                  <>
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                      style={{ textDecoration: "none" }}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square mr-2" />View
                    </a>
                    <button
                      type="button"
                      onClick={() => setShareOpen(true)}
                      className="text-sm bg-luc-blue hover:bg-luc-blue-hover transition-colors text-white px-4 py-2 rounded-btn"
                    >
                      <i className="fa-solid fa-share-nodes mr-2" />Share
                    </button>
                  </>
                )}
                <Form method="post">
                  <input type="hidden" name="intent" value={published ? "unpublish" : "publish"} />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`text-sm px-4 py-2 rounded-btn transition-colors disabled:opacity-60 ${
                      published
                        ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    {published ? (
                      <><i className="fa-solid fa-eye-slash mr-2" />Unpublish</>
                    ) : (
                      <><i className="fa-solid fa-rocket mr-2" />Publish</>
                    )}
                  </button>
                </Form>
              </div>
            </div>

            {published && publicUrl && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-green-200">
                <code className="flex-1 text-sm text-gray-700 bg-white border border-gray-200 rounded-md px-3 py-2 truncate">
                  {publicUrl}
                </code>
                <button
                  type="button"
                  onClick={copyLink}
                  className="text-sm border border-gray-300 bg-white text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50 whitespace-nowrap"
                >
                  <i className="fa-solid fa-copy mr-2" />Copy
                </button>
              </div>
            )}
          </div>

          {!handle && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-6 text-sm text-blue-800">
              <i className="fa-solid fa-circle-info mr-2" />
              You need a handle before publishing.{" "}
              <Link to="/app/cabinet/profile" className="underline font-medium">Set one on your profile</Link>.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 lg:col-span-1">
              <div className="flex flex-col items-center text-center">
                <img
                  src={avatarUrl || "/images/default-avatar.svg"}
                  alt={displayName}
                  className="w-20 h-20 rounded-full object-cover border border-gray-300 bg-gray-100 mb-3"
                />
                <h2 className="luc-heading text-lg font-medium">{displayName}</h2>
                {handle && <p className="text-sm text-gray-400">@{handle}</p>}
                {location && (
                  <p className="text-xs text-gray-500 mt-1">
                    <i className="fa-solid fa-location-dot mr-1" />{location}
                  </p>
                )}
                {bio && <p className="text-sm text-gray-600 mt-3">{bio}</p>}
                <Link
                  to="/app/cabinet/profile"
                  className="text-xs text-luc-blue hover:underline mt-4"
                  style={{ textDecoration: "none" }}
                >
                  <i className="fa-solid fa-pen mr-1" />Edit profile details
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 lg:col-span-2">
              <h2 className="luc-heading text-sm font-medium mb-4">Your Collection at a Glance</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Completion" value={`${stats.completionPercent}%`} icon="fa-percent" />
                <Stat label="Elements Owned" value={stats.totalOwned} icon="fa-atom" />
                <Stat label="Sets Completed" value={stats.setsCompleted} icon="fa-layer-group" />
                <Stat label="Formats" value={stats.formatsCollected.length} icon="fa-cubes" />
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Periodic table progress</span>
                  <span>{stats.totalOwned}/{stats.totalElements}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-luc-blue rounded-full"
                    style={{ width: `${Math.min(100, stats.completionPercent)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Featured elements */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="luc-heading text-sm font-medium">Featured Elements</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Showcase up to {maxFeatured} of your owned elements on your Passport.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="text-sm border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
              >
                <i className="fa-solid fa-sliders mr-2" />Manage
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Array.from({ length: maxFeatured }).map((_, i) => {
                const el = selected[i];
                if (!el) {
                  return (
                    <button
                      key={`empty-${i}`}
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-300 hover:border-gray-300 hover:text-gray-400"
                    >
                      <i className="fa-solid fa-plus text-lg" />
                    </button>
                  );
                }
                return (
                  <div key={el.uid || el.symbol} className="aspect-square rounded-lg border border-gray-200 overflow-hidden bg-gray-50 relative">
                    {el.imageUrl ? (
                      <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                        <span className="text-2xl font-semibold luc-heading">{el.symbol}</span>
                        <span className="text-[10px] text-gray-500 mt-1">{el.name}</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] px-1.5 py-0.5 truncate">
                      {el.name}{el.formatName ? ` · ${el.formatName}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Featured picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="luc-heading text-base font-medium">
                Choose Featured Elements
                <span className="text-sm text-gray-400 font-normal ml-2">
                  {selected.length}/{maxFeatured} selected
                </span>
              </h3>
              <button type="button" onClick={() => setPickerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-gray-100">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your owned elements…"
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-luc-blue"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {ownedElements.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-10">
                  You don't own any elements yet. Add items to your collection first.
                </p>
              ) : filteredOwned.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-10">No elements match "{search}".</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredOwned.map((el) => {
                    const isSel = selectedUids.has(el.uid);
                    const disabled = !isSel && selected.length >= maxFeatured;
                    return (
                      <button
                        key={el.uid}
                        type="button"
                        onClick={() => toggleElement(el)}
                        disabled={disabled}
                        className={`flex items-center gap-3 border rounded-lg p-2.5 text-left transition-colors ${
                          isSel
                            ? "border-luc-blue bg-blue-50"
                            : disabled
                            ? "border-gray-100 opacity-50 cursor-not-allowed"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="w-11 h-11 rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {el.imageUrl ? (
                            <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-semibold luc-heading">{el.symbol}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{el.name}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {el.symbol}{el.formatName ? ` · ${el.formatName}` : ""}
                          </p>
                        </div>
                        {el.isWishlisted && (
                          <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            <i className="fa-solid fa-heart mr-1" />Wishlist
                          </span>
                        )}
                        {isSel && <i className="fa-solid fa-circle-check text-luc-blue flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="text-sm border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <Form method="post" onSubmit={() => setPickerOpen(false)}>
                  <input type="hidden" name="intent" value="save-featured" />
                  <input type="hidden" name="featured" value={JSON.stringify(selected)} />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="text-sm bg-luc-blue hover:bg-luc-blue-hover transition-colors text-white px-5 py-2 rounded-btn disabled:opacity-60"
                  >
                    Save Featured
                  </button>
                </Form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareOpen && publicUrl && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="luc-heading text-base font-medium">Share your Passport</h3>
              <button type="button" onClick={() => setShareOpen(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Your public link</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 truncate">
                    {publicUrl}
                  </code>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="text-sm border border-gray-300 bg-white text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50 whitespace-nowrap"
                  >
                    <i className="fa-solid fa-copy" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Suggested caption</label>
                <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  {shareText}
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(publicUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center text-sm border border-gray-300 bg-white text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50"
                  style={{ textDecoration: "none" }}
                >
                  <i className="fa-brands fa-x-twitter mr-2" />Post
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center text-sm border border-gray-300 bg-white text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50"
                  style={{ textDecoration: "none" }}
                >
                  <i className="fa-brands fa-facebook mr-2" />Share
                </a>
                <button
                  type="button"
                  onClick={nativeShare}
                  className="flex-1 text-sm bg-luc-blue hover:bg-luc-blue-hover transition-colors text-white px-3 py-2 rounded-btn"
                >
                  <i className="fa-solid fa-share-nodes mr-2" />More
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
      <i className={`fa-solid ${icon} text-luc-blue mb-1`} />
      <div className="luc-heading text-xl font-semibold">{value}</div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}
