/**
 * Admin Analytics — /app/admin/analytics
 *
 * Real-data analytics for the consolidated (isStaff-gated) admin. Date-range
 * quick-select, dropdown filters (motivation / format / tier), daily-activity
 * & signup bar graphs, most-popular elements, most-active users, tier
 * distribution, and a multi-CSV ZIP export.
 *
 * Every figure on this page is computed from live Prisma queries — there is no
 * mock data. (This replaced an earlier mock-db.server-backed dashboard.)
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useSearchParams } from "@remix-run/react";
import { useState, useMemo, useCallback } from "react";
import { prisma } from "../lib/db.server.js";
import { requireAdmin } from "../lib/admin.server.js";

/* ────────────────────────────────────────── helpers ── */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Bucket a list of Date objects into a continuous per-day series between
 * `from` and `to` (inclusive). Days with no records report a count of 0 so the
 * bar graphs render an even x-axis. Defaults to the last 30 days when no range
 * is supplied.
 */
function bucketByDay(dates, from, to) {
  const start = from ? new Date(from + "T00:00:00") : new Date(daysAgo(30) + "T00:00:00");
  const end = to ? new Date(to + "T23:59:59") : new Date();
  // Count records per YYYY-MM-DD.
  const counts = {};
  for (const dt of dates) {
    const key = new Date(dt).toISOString().split("T")[0];
    counts[key] = (counts[key] || 0) + 1;
  }
  const series = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  // Guard against pathological ranges producing an unbounded loop.
  let guard = 0;
  while (cur <= last && guard < 1000) {
    const key = cur.toISOString().split("T")[0];
    series.push({ date: key, count: counts[key] || 0 });
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return series;
}

/* ────────────────────────────────────────── loader ── */
export const loader = async ({ request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const motivationFilter = url.searchParams.get("motivation");
  const formatFilter = url.searchParams.get("format");
  const tierFilter = url.searchParams.get("tier");

  // Date filter shared by user + collection-item queries.
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to + "T23:59:59Z");

  const userWhere = {};
  if (from || to) userWhere.createdAt = dateFilter;
  if (motivationFilter) userWhere.primaryMotivation = { contains: motivationFilter };
  if (tierFilter) userWhere.tier = tierFilter;

  const collItemWhere = { state: "OWNED" };
  if (formatFilter) collItemWhere.format = formatFilter;
  if (from || to) collItemWhere.createdAt = dateFilter;

  // ─── Core metrics (real) ───
  const [totalUsers, activeUsers, frozenUsers] = await Promise.all([
    prisma.user.count({ where: userWhere }),
    prisma.user.count({ where: { ...userWhere, status: "active" } }),
    prisma.user.count({ where: { ...userWhere, status: "frozen" } }),
  ]);

  const totalOwned = await prisma.collectionItem.count({ where: collItemWhere });
  const avgSize = totalUsers > 0 ? Math.round(totalOwned / totalUsers) : 0;

  // ─── Motivation breakdown (real) ───
  const usersWithMotivation = await prisma.user.findMany({
    where: { ...userWhere, primaryMotivation: { not: null } },
    select: { primaryMotivation: true },
  });
  const motivationCountsMap = {};
  for (const u of usersWithMotivation) {
    if (!u.primaryMotivation) continue;
    try {
      const parsed = JSON.parse(u.primaryMotivation);
      if (Array.isArray(parsed)) {
        for (const m of parsed) motivationCountsMap[m] = (motivationCountsMap[m] || 0) + 1;
      } else {
        motivationCountsMap[u.primaryMotivation] = (motivationCountsMap[u.primaryMotivation] || 0) + 1;
      }
    } catch {
      motivationCountsMap[u.primaryMotivation] = (motivationCountsMap[u.primaryMotivation] || 0) + 1;
    }
  }
  const motivations = Object.entries(motivationCountsMap)
    .map(([key, count]) => ({
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // ─── Format popularity (real, from OWNED collection items) ───
  const formatRaw = await prisma.collectionItem.groupBy({
    by: ["format"],
    where: { state: "OWNED", format: { not: null } },
    _count: true,
  });
  const formats = formatRaw
    .filter((f) => f.format)
    .map((f) => ({ label: f.format, count: f._count }))
    .sort((a, b) => b.count - a.count);

  // ─── Tier breakdown (real) ───
  const tierRaw = await prisma.user.groupBy({
    by: ["tier"],
    where: from || to ? { createdAt: dateFilter } : {},
    _count: true,
  });
  const allTierLabels = ["Free", "Collector", "Curator", "Lucite Pro"];
  const tierMap = {};
  tierRaw.forEach((t) => { tierMap[t.tier] = t._count; });
  const tiers = allTierLabels.map((label) => ({ label, count: tierMap[label] || 0 }));

  // ─── Daily activity: OWNED items added per day (real) ───
  const ownedInRange = await prisma.collectionItem.findMany({
    where: collItemWhere,
    select: { createdAt: true },
  });
  const dailyActivity = bucketByDay(ownedInRange.map((i) => i.createdAt), from, to);
  const totalElementsAdded = dailyActivity.reduce((s, d) => s + d.count, 0);

  // ─── Daily signups: new users per day (real) ───
  const signupsInRange = await prisma.user.findMany({
    where: userWhere,
    select: { createdAt: true },
  });
  const dailySignups = bucketByDay(signupsInRange.map((u) => u.createdAt), from, to);

  // ─── Most popular elements (real, top 20 OWNED by symbol) ───
  const popularRaw = await prisma.collectionItem.groupBy({
    by: ["elementSymbol"],
    where: { state: "OWNED" },
    _count: { elementSymbol: true },
    orderBy: { _count: { elementSymbol: "desc" } },
    take: 20,
  });
  // Resolve one display name per symbol.
  const symbolNames = {};
  if (popularRaw.length > 0) {
    const named = await prisma.collectionItem.findMany({
      where: { elementSymbol: { in: popularRaw.map((p) => p.elementSymbol) } },
      select: { elementSymbol: true, elementName: true },
      distinct: ["elementSymbol"],
    });
    named.forEach((n) => { symbolNames[n.elementSymbol] = n.elementName; });
  }
  const popularElements = popularRaw.map((p) => ({
    symbol: p.elementSymbol,
    name: symbolNames[p.elementSymbol] || p.elementSymbol,
    count: p._count.elementSymbol,
  }));

  // ─── Most active users (real, top 10 by OWNED item count) ───
  const activeRaw = await prisma.collectionItem.groupBy({
    by: ["userId"],
    where: { state: "OWNED" },
    _count: { userId: true },
    orderBy: { _count: { userId: "desc" } },
    take: 10,
  });
  const activeUsersMap = {};
  if (activeRaw.length > 0) {
    const activeUserRecords = await prisma.user.findMany({
      where: { id: { in: activeRaw.map((a) => a.userId) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    activeUserRecords.forEach((u) => { activeUsersMap[u.id] = u; });
  }
  const activeUsersList = activeRaw.map((a) => {
    const u = activeUsersMap[a.userId];
    return {
      name: u ? `${u.firstName} ${u.lastName}`.trim() || u.email : "Unknown",
      email: u ? u.email : a.userId,
      count: a._count.userId,
    };
  });

  // Format breakdown reuses the real format popularity (top formats).
  const formatBreakdown = formats.slice(0, 6);

  return json({
    totalUsers,
    activeUsers,
    frozenUsers,
    totalOwned,
    avgSize,
    motivations,
    formats,
    tiers,
    dailyActivity,
    dailySignups,
    popularElements,
    activeUsersList,
    formatBreakdown,
    totalElementsAdded,
    filters: {
      from: from || "",
      to: to || "",
      motivation: motivationFilter || "",
      format: formatFilter || "",
      tier: tierFilter || "",
    },
  });
};

/* ────────────────────────────────────────── action (ZIP export with multiple CSVs) ── */
export const action = async ({ request }) => {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "export") {
    const archiver = (await import("archiver")).default;

    const [users, milestones, userMilestones, collections, formats] = await Promise.all([
      prisma.user.findMany({
        select: {
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          tier: true,
          primaryMotivation: true,
          createdAt: true,
          _count: { select: { collectionItems: { where: { state: "OWNED" } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.milestoneDefinition.findMany({
        select: { name: true, description: true, category: true, icon: true },
        orderBy: { name: "asc" },
      }),
      prisma.userMilestoneAward.findMany({
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          milestone: { select: { name: true } },
        },
        orderBy: { awardedAt: "desc" },
      }),
      prisma.elementSample.findMany({
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.collectionItem.groupBy({
        by: ["format"],
        where: { state: "OWNED", format: { not: null } },
        _count: true,
      }),
    ]);

    const csvEscape = (val) => {
      if (val == null) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let usersCsv = "Email,First Name,Last Name,Status,Tier,Motivation,Join Date,Collection Count\n";
    users.forEach((u) => {
      usersCsv += `${csvEscape(u.email)},${csvEscape(u.firstName)},${csvEscape(u.lastName)},${csvEscape(u.status)},${csvEscape(u.tier)},${csvEscape(u.primaryMotivation)},${new Date(u.createdAt).toISOString().split("T")[0]},${u._count.collectionItems}\n`;
    });

    let milestonesCsv = "Name,Description,Category,Icon\n";
    milestones.forEach((m) => {
      milestonesCsv += `${csvEscape(m.name)},${csvEscape(m.description)},${csvEscape(m.category)},${csvEscape(m.icon)}\n`;
    });

    let userMilestonesCsv = "User Email,User Name,Milestone Name,Awarded By,Awarded Date\n";
    userMilestones.forEach((um) => {
      userMilestonesCsv += `${csvEscape(um.user.email)},${csvEscape(`${um.user.firstName} ${um.user.lastName}`)},${csvEscape(um.milestone.name)},${csvEscape(um.awardedBy)},${new Date(um.awardedAt).toISOString()}\n`;
    });

    let collectionsCsv = "User Email,Element Symbol,Format,Acquisition Date,Source,Price Paid,Currency,Condition,Notes\n";
    collections.forEach((c) => {
      collectionsCsv += `${csvEscape(c.user.email)},${csvEscape(c.elementSymbol)},${csvEscape(c.format)},${c.acquisitionDate ? new Date(c.acquisitionDate).toISOString().split("T")[0] : ""},${csvEscape(c.source)},${c.pricePaid || ""},${csvEscape(c.currency)},${csvEscape(c.condition)},${csvEscape(c.notes)}\n`;
    });

    let formatsCsv = "Format,Count\n";
    formats.forEach((f) => {
      formatsCsv += `${csvEscape(f.format)},${f._count}\n`;
    });

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.status === "active").length;
    const frozenUsers = users.filter((u) => u.status === "frozen").length;
    const totalCollections = collections.length;
    const avgCollectionSize = totalUsers > 0 ? (totalCollections / totalUsers).toFixed(2) : 0;

    let summaryCsv = "Metric,Value\n";
    summaryCsv += `Total Users,${totalUsers}\n`;
    summaryCsv += `Active Users,${activeUsers}\n`;
    summaryCsv += `Frozen Users,${frozenUsers}\n`;
    summaryCsv += `Total Collection Items,${totalCollections}\n`;
    summaryCsv += `Average Collection Size,${avgCollectionSize}\n`;
    summaryCsv += `Total Milestones Defined,${milestones.length}\n`;
    summaryCsv += `Total Milestone Awards,${userMilestones.length}\n`;
    summaryCsv += `Export Date,${new Date().toISOString()}\n`;

    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks = [];
    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("error", (err) => { throw err; });

    archive.append(usersCsv, { name: "users.csv" });
    archive.append(milestonesCsv, { name: "milestones.csv" });
    archive.append(userMilestonesCsv, { name: "user_milestones.csv" });
    archive.append(collectionsCsv, { name: "collections.csv" });
    archive.append(formatsCsv, { name: "formats.csv" });
    archive.append(summaryCsv, { name: "analytics_summary.csv" });

    await archive.finalize();
    const buffer = Buffer.concat(chunks);

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="analytics-export-${new Date().toISOString().split("T")[0]}.zip"`,
      },
    });
  }
  return json({});
};

/* ────────────────────────────────────────── components ── */
function MetricCard({ title, value, icon, accent = "#2563eb" }) {
  return (
    <div style={{ ...S.metricCard, borderTopColor: accent }}>
      <div style={S.metricIcon}>{icon}</div>
      <div style={S.metricValue}>{value}</div>
      <div style={S.metricTitle}>{title}</div>
    </div>
  );
}

function VerticalBarGraph({ data, label, color = "#2563eb", height = 220 }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const barW = data.length > 0 ? Math.max(4, Math.min(24, Math.floor(600 / data.length) - 2)) : 12;

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <h3 style={S.cardTitle}>{label}</h3>
      </div>
      <div style={{ padding: "16px 12px", overflowX: "auto" }}>
        {data.length === 0 ? (
          <div style={S.empty}>No data for this range</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 2,
                height,
                minWidth: data.length * (barW + 2),
              }}
            >
              {data.map((d) => (
                <div
                  key={d.date}
                  title={`${fmtDate(d.date)}: ${d.count}`}
                  style={{
                    width: barW,
                    height: `${(d.count / max) * 100}%`,
                    minHeight: 2,
                    background: color,
                    borderRadius: "3px 3px 0 0",
                    cursor: "default",
                    transition: "height 0.2s",
                    opacity: 0.85,
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 2, minWidth: data.length * (barW + 2), marginTop: 6 }}>
              {data.map((d, i) => {
                const step = Math.max(1, Math.floor(data.length / 6));
                if (i % step !== 0 && i !== data.length - 1) return <div key={d.date} style={{ width: barW }} />;
                return (
                  <div
                    key={d.date}
                    style={{ width: barW, fontSize: 9, color: "#9ca3af", textAlign: "center", whiteSpace: "nowrap" }}
                  >
                    {fmtDate(d.date)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Dropdown({ label, value, options, onChange, placeholder = "All" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 150 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={S.filterSelect}>
        <option value="">{placeholder}</option>
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const lbl = typeof o === "string" ? o : o.label;
          return (
            <option key={val} value={val}>{lbl}</option>
          );
        })}
      </select>
    </div>
  );
}

/* ────────────────────────────────────────── main component ── */
export default function AdminAnalytics() {
  const d = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCustom, setShowCustom] = useState(
    !!(d.filters.from || d.filters.to) &&
    d.filters.from !== daysAgo(7) &&
    d.filters.from !== daysAgo(30) &&
    d.filters.from !== startOfMonth()
  );

  const setRange = useCallback(
    (from, to) => {
      const params = new URLSearchParams(searchParams);
      if (from) params.set("from", from); else params.delete("from");
      if (to) params.set("to", to); else params.delete("to");
      setSearchParams(params);
      setShowCustom(false);
    },
    [searchParams, setSearchParams]
  );

  const setFilter = useCallback(
    (key, val) => {
      const params = new URLSearchParams(searchParams);
      if (val) params.set(key, val); else params.delete(key);
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const activeRange = useMemo(() => {
    if (d.filters.from === daysAgo(7) && !d.filters.to) return "7d";
    if (d.filters.from === startOfMonth() && !d.filters.to) return "month";
    if (d.filters.from === daysAgo(30) && !d.filters.to) return "30d";
    if (!d.filters.from && !d.filters.to) return "all";
    return "custom";
  }, [d.filters.from, d.filters.to]);

  const motivationOptions = [
    { value: "inventory_management", label: "Inventory Management" },
    { value: "social_sharing", label: "Social Sharing" },
    { value: "acquisition_planning", label: "Acquisition Planning" },
    { value: "investment_tracking", label: "Investment Tracking" },
    { value: "just_exploring", label: "Just Exploring" },
  ];
  const formatOptions = d.formats.map((f) => f.label);
  const tierOptions = ["Free", "Collector", "Curator", "Lucite Pro"];

  return (
    <div>
      {/* ─── Header ─── */}
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.h1}>📈 Analytics</h1>
          <p style={S.subtitle}>Platform metrics, user behaviour &amp; collection insights — live data.</p>
        </div>
        <Form method="post">
          <input type="hidden" name="intent" value="export" />
          <button type="submit" style={S.exportBtn}>📦 Export Data (ZIP)</button>
        </Form>
      </div>

      {/* ─── Date Range Quick-Select ─── */}
      <div style={S.filterBar}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginRight: 4 }}>📅 Date Range:</span>
          {[
            { key: "7d", label: "Last 7 days", from: daysAgo(7), to: null },
            { key: "month", label: "This month", from: startOfMonth(), to: null },
            { key: "30d", label: "Last 30 days", from: daysAgo(30), to: null },
          ].map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.from, r.to)}
              style={{ ...S.rangeBtn, ...(activeRange === r.key ? S.rangeBtnActive : {}) }}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => setShowCustom(!showCustom)}
            style={{ ...S.rangeBtn, ...(activeRange === "custom" ? S.rangeBtnActive : {}) }}
          >
            Custom
          </button>
          {(d.filters.from || d.filters.to) && (
            <button onClick={() => { setRange(null, null); setShowCustom(false); }} style={S.clearFilterBtn}>
              ✕ Clear
            </button>
          )}
        </div>

        {showCustom && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <label style={{ fontSize: 12, color: "#6b7280" }}>From:</label>
            <input type="date" value={d.filters.from} onChange={(e) => setFilter("from", e.target.value)} style={S.dateInput} />
            <label style={{ fontSize: 12, color: "#6b7280" }}>To:</label>
            <input type="date" value={d.filters.to} onChange={(e) => setFilter("to", e.target.value)} style={S.dateInput} />
          </div>
        )}
      </div>

      {/* ─── Dropdown Filters ─── */}
      <div style={S.filterBar}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", alignSelf: "center", marginRight: 4 }}>🔽 Filters:</span>
          <Dropdown label="Motivation" value={d.filters.motivation} options={motivationOptions} onChange={(v) => setFilter("motivation", v)} placeholder="All Motivations" />
          <Dropdown label="Format" value={d.filters.format} options={formatOptions} onChange={(v) => setFilter("format", v)} placeholder="All Formats" />
          <Dropdown label="Tier" value={d.filters.tier} options={tierOptions} onChange={(v) => setFilter("tier", v)} placeholder="All Tiers" />
          {(d.filters.motivation || d.filters.format || d.filters.tier) && (
            <button
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.delete("motivation");
                params.delete("format");
                params.delete("tier");
                setSearchParams(params);
              }}
              style={{ ...S.clearFilterBtn, alignSelf: "flex-end", marginBottom: 2 }}
            >
              ✕ Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ─── Summary Metrics ─── */}
      <div style={S.metricsGrid}>
        <MetricCard title="Total Users" value={d.totalUsers} icon="👥" accent="#2563eb" />
        <MetricCard title="Active Users" value={d.activeUsers} icon="✅" accent="#059669" />
        <MetricCard title="Frozen Users" value={d.frozenUsers} icon="❄️" accent="#dc2626" />
        <MetricCard title="Total Owned" value={d.totalOwned} icon="🧊" accent="#7c3aed" />
        <MetricCard title="Avg Collection Size" value={d.avgSize} icon="📊" accent="#0891b2" />
      </div>

      {/* ─── Two Bar Graphs ─── */}
      <div style={S.chartsGrid}>
        <VerticalBarGraph data={d.dailyActivity} label="📊 Daily Activity — Elements Added per Day" color="#4f46e5" />
        <VerticalBarGraph data={d.dailySignups} label="👤 New User Signups per Day" color="#059669" />
      </div>

      {/* ─── Tier Distribution ─── */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <h3 style={S.cardTitle}>🏷️ Tier Distribution — Users by Plan</h3>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            {d.tiers.map((t) => {
              const tierColors = {
                Free: { bg: "#f3f4f6", border: "#d1d5db", accent: "#6b7280" },
                Collector: { bg: "#eff6ff", border: "#bfdbfe", accent: "#2563eb" },
                Curator: { bg: "#f5f3ff", border: "#c4b5fd", accent: "#7c3aed" },
                "Lucite Pro": { bg: "#fdf4ff", border: "#f0abfc", accent: "#a855f7" },
              };
              const c = tierColors[t.label] || tierColors.Free;
              const total = d.tiers.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? ((t.count / total) * 100).toFixed(1) : 0;
              return (
                <div
                  key={t.label}
                  style={{
                    flex: "1 1 140px",
                    padding: "16px 20px",
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    borderRadius: 10,
                    textAlign: "center",
                    minWidth: 130,
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 700, color: c.accent }}>{t.count}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 2 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{pct}% of users</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#e5e7eb" }}>
            {d.tiers.map((t) => {
              const total = d.tiers.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? (t.count / total) * 100 : 0;
              const barColors = { Free: "#9ca3af", Collector: "#2563eb", Curator: "#7c3aed", "Lucite Pro": "#a855f7" };
              return pct > 0 ? (
                <div
                  key={t.label}
                  title={`${t.label}: ${t.count} (${pct.toFixed(1)}%)`}
                  style={{ width: `${pct}%`, background: barColors[t.label] || "#9ca3af", transition: "width 0.3s" }}
                />
              ) : null;
            })}
          </div>
        </div>
      </div>

      {/* ─── Collection Additions Section ─── */}
      <div style={{ ...S.card, border: "1px solid #c7d2fe" }}>
        <div style={{ ...S.cardHeader, background: "#eef2ff", borderBottom: "1px solid #c7d2fe" }}>
          <h3 style={{ ...S.cardTitle, color: "#3730a3" }}>📦 Collection Insights</h3>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "#f0f4ff", borderRadius: 8, padding: "10px 20px",
            marginBottom: 20, border: "1px solid #c7d2fe",
          }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#4338ca" }}>{d.totalElementsAdded}</span>
            <span style={{ fontSize: 13, color: "#6b7280" }}>owned elements added in period</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {/* Most Popular Elements */}
            <div style={S.innerCard}>
              <h4 style={S.innerCardTitle}>🔥 Most Popular Elements (Top {d.popularElements.length})</h4>
              {d.popularElements.length === 0 ? (
                <div style={S.empty}>No owned elements yet</div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: "auto" }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>#</th>
                        <th style={S.th}>Element</th>
                        <th style={S.th}>Symbol</th>
                        <th style={{ ...S.th, textAlign: "right" }}>Owned By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.popularElements.map((el, i) => (
                        <tr key={el.symbol} style={i % 2 === 0 ? {} : { background: "#f9fafb" }}>
                          <td style={S.td}>{i + 1}</td>
                          <td style={S.td}>{el.name}</td>
                          <td style={{ ...S.td, fontWeight: 700, color: "#4338ca" }}>{el.symbol}</td>
                          <td style={{ ...S.td, textAlign: "right", fontWeight: 600 }}>{el.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right column: leaderboard + format breakdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Most Active Users */}
              <div style={S.innerCard}>
                <h4 style={S.innerCardTitle}>🏆 Most Active Collectors (Top {d.activeUsersList.length})</h4>
                {d.activeUsersList.length === 0 ? (
                  <div style={S.empty}>No collection data yet</div>
                ) : (
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>#</th>
                          <th style={S.th}>User</th>
                          <th style={{ ...S.th, textAlign: "right" }}>Owned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.activeUsersList.map((u, i) => (
                          <tr key={u.email} style={i % 2 === 0 ? {} : { background: "#f9fafb" }}>
                            <td style={S.td}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                            <td style={S.td}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                              <div style={{ fontSize: 11, color: "#9ca3af" }}>{u.email}</div>
                            </td>
                            <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: "#059669" }}>{u.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Format Breakdown */}
              <div style={S.innerCard}>
                <h4 style={S.innerCardTitle}>📐 Format Breakdown (Owned)</h4>
                {d.formatBreakdown.length === 0 ? (
                  <div style={S.empty}>No format data yet</div>
                ) : (
                  d.formatBreakdown.map((f) => {
                    const maxF = Math.max(...d.formatBreakdown.map((x) => x.count), 1);
                    return (
                      <div key={f.label} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, color: "#374151" }}>{f.label}</span>
                          <span style={{ fontWeight: 700, color: "#111827" }}>{f.count}</span>
                        </div>
                        <div style={{ height: 10, background: "#f3f4f6", borderRadius: 5, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(f.count / maxF) * 100}%`, background: "#6366f1", borderRadius: 5, transition: "width 0.3s" }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Motivations */}
          {d.motivations.length > 0 && (
            <div style={{ ...S.innerCard, marginTop: 20 }}>
              <h4 style={S.innerCardTitle}>🎯 Collector Motivations</h4>
              {d.motivations.map((m) => {
                const maxM = Math.max(...d.motivations.map((x) => x.count), 1);
                return (
                  <div key={m.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, color: "#374151" }}>{m.label}</span>
                      <span style={{ fontWeight: 700, color: "#111827" }}>{m.count}</span>
                    </div>
                    <div style={{ height: 10, background: "#f3f4f6", borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(m.count / maxM) * 100}%`, background: "#0891b2", borderRadius: 5, transition: "width 0.3s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────── styles ── */
const S = {
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  h1: { fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  exportBtn: {
    padding: "8px 16px", background: "#fff", border: "1px solid #d1d5db",
    borderRadius: 6, fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 500,
  },
  filterBar: {
    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
    padding: "12px 16px", marginBottom: 14,
  },
  rangeBtn: {
    padding: "6px 14px", background: "#f9fafb", border: "1px solid #d1d5db",
    borderRadius: 6, fontSize: 12, color: "#374151", cursor: "pointer", fontWeight: 500,
    transition: "all 0.15s",
  },
  rangeBtnActive: { background: "#2563eb", border: "1px solid #2563eb", color: "#fff", fontWeight: 600 },
  clearFilterBtn: {
    padding: "5px 10px", background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 4, fontSize: 11, color: "#991b1b", cursor: "pointer", fontWeight: 500,
  },
  dateInput: { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, color: "#374151" },
  filterSelect: {
    padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6,
    fontSize: 13, color: "#374151", background: "#fff", cursor: "pointer",
    minWidth: 150, appearance: "auto",
  },
  metricsGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
    gap: 14, marginBottom: 22,
  },
  metricCard: {
    background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb",
    borderTop: "3px solid #2563eb", padding: "14px 16px",
  },
  metricIcon: { fontSize: 18, marginBottom: 2 },
  metricValue: { fontSize: 26, fontWeight: 700, color: "#111827" },
  metricTitle: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  chartsGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
    gap: 18, marginBottom: 22,
  },
  card: {
    background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb",
    overflow: "hidden", marginBottom: 20,
  },
  cardHeader: { padding: "12px 18px", borderBottom: "1px solid #e5e7eb" },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 },
  empty: { padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 },
  innerCard: {
    background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb",
    padding: 14, overflow: "hidden",
  },
  innerCardTitle: { fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 10px 0" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: {
    padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "#6b7280",
    borderBottom: "1px solid #e5e7eb", fontSize: 11, textTransform: "uppercase",
    letterSpacing: 0.3, position: "sticky", top: 0, background: "#f9fafb",
  },
  td: { padding: "7px 8px", borderBottom: "1px solid #f3f4f6", color: "#374151" },
};
