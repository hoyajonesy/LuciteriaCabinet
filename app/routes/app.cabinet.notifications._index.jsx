/**
 * Notification Center — matches wireframe: notification-inbox.html
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams } from "@remix-run/react";
import AppNav from "../components/AppNav";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
} from "../lib/notifications-db.server";

// Map server category → FA icon + filter group
const CATEGORY_META = {
  MILESTONE: { icon: "fa-trophy", group: "milestones" },
  NEAR_COMPLETION: { icon: "fa-bullseye", group: "recommendations" },
  RESTOCK: { icon: "fa-box", group: "restocks" },
  NEW_ARRIVAL: { icon: "fa-lightbulb", group: "recommendations" },
  SYSTEM: { icon: "fa-gear", group: "other" },
  ADMIN: { icon: "fa-bullhorn", group: "other" },
};

function timeAgo(date) {
  const d = new Date(date);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all";

  const all = await getNotifications(userId, {});
  const unreadCount = await getUnreadCount(userId);

  const mapped = all.map((n) => {
    const meta = CATEGORY_META[n.category] || CATEGORY_META.SYSTEM;
    return {
      id: n.id,
      category: n.category,
      group: meta.group,
      faIcon: meta.icon,
      title: n.title,
      body: n.body,
      linkUrl: n.linkUrl,
      isRead: n.isRead,
      createdAt: n.createdAt,
    };
  });

  const counts = {
    all: mapped.length,
    milestones: mapped.filter((n) => n.group === "milestones").length,
    restocks: mapped.filter((n) => n.group === "restocks").length,
    recommendations: mapped.filter((n) => n.group === "recommendations").length,
  };

  const filtered = filter === "all" ? mapped : mapped.filter((n) => n.group === filter);

  return json({
    notifications: filtered,
    counts,
    filter,
    unreadCount,
    firstName: authUser.firstName || "Collector",
  });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "read") await markRead(userId, form.get("id"));
  else if (intent === "read-all") await markAllRead(userId);
  else if (intent === "delete") await deleteNotification(userId, form.get("id"));

  return json({ ok: true });
};

const FILTERS = [
  { id: "all", label: "All", icon: "fa-inbox" },
  { id: "milestones", label: "Milestones", icon: "fa-trophy" },
  { id: "restocks", label: "Restocks", icon: "fa-box" },
  { id: "recommendations", label: "Recommendations", icon: "fa-lightbulb" },
];

export default function NotificationCenter() {
  const { notifications, counts, filter, unreadCount, firstName } = useLoaderData();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();

  const setFilter = (id) => {
    const params = new URLSearchParams(searchParams);
    if (id === "all") params.delete("filter");
    else params.set("filter", id);
    setSearchParams(params);
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AppNav mode="customer" customerName={firstName} currentPath="/app/cabinet/notifications" unreadCount={unreadCount} />
      <main className="luc-main flex-1">
        <div className="min-h-[900px] max-w-[1100px] mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">Notifications</h1>
              <p className="text-sm text-gray-500">Your collection activity, in one place.</p>
            </div>
            <button
              type="button"
              onClick={() => fetcher.submit({ intent: "read-all" }, { method: "post" })}
              className="text-sm border border-gray-300 bg-white rounded px-3 py-2 text-gray-600 hover:bg-gray-50"
            >
              <i className="fa-regular fa-circle-check mr-1" /> Mark all as read
            </button>
          </div>

          <div className="flex gap-6">
            {/* Filter sidebar */}
            <aside className="w-52 flex-shrink-0">
              <nav className="bg-white border border-gray-300 rounded text-sm overflow-hidden">
                {FILTERS.map((f, i) => {
                  const active = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-left ${
                        active
                          ? "bg-gray-200 text-gray-800 font-medium border-l-2 border-gray-600"
                          : "text-gray-600 hover:bg-gray-50"
                      } ${i > 0 ? "border-t border-gray-200" : ""}`}
                    >
                      <span>
                        <i className={`fa-solid ${f.icon} mr-2`} />
                        {f.label}
                      </span>
                      <span className={`text-xs rounded-full px-2 ${active ? "bg-gray-300" : "bg-gray-200"}`}>
                        {counts[f.id]}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Notification list */}
            <section className="flex-1 bg-white border border-gray-300 rounded divide-y divide-gray-200">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-400 text-xl mb-3">
                    <i className="fa-regular fa-bell-slash" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700">No notifications here</h3>
                  <p className="text-sm text-gray-500">
                    When something happens in this category, it'll show up here.
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <article key={n.id} className={`flex gap-4 px-5 py-4 ${n.isRead ? "" : "bg-gray-50"}`}>
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.isRead ? "bg-transparent" : "bg-gray-600"}`} />
                    <div className="w-9 h-9 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center text-gray-500 flex-shrink-0">
                      <i className={`fa-solid ${n.faIcon}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-sm text-gray-800 ${n.isRead ? "font-medium text-gray-700" : "font-semibold"}`}>
                          {n.title}
                        </h3>
                        <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>
                    </div>
                    <div className="flex gap-2 text-gray-400 text-sm flex-shrink-0">
                      {!n.isRead && (
                        <button title="Mark read" onClick={() => fetcher.submit({ intent: "read", id: n.id }, { method: "post" })} className="hover:text-gray-600">
                          <i className="fa-regular fa-circle-check" />
                        </button>
                      )}
                      <button title="Delete" onClick={() => fetcher.submit({ intent: "delete", id: n.id }, { method: "post" })} className="hover:text-gray-600">
                        <i className="fa-regular fa-trash-can" />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
