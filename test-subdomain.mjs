/**
 * Edge-case test suite for subdomain detection + routing guard.
 * Run with:  npx vite-node test-subdomain.mjs
 *
 * Exercises the pure logic (parseHost, evaluateRoute, isAdminPath, isBypassPath)
 * and the request-aware enforceSubdomainRouting() including thrown redirects/404s.
 */
import {
  parseHost,
  normalizeHost,
  getSubdomainInfo,
} from "./app/lib/subdomain.server.js";
import {
  evaluateRoute,
  isAdminPath,
  isBypassPath,
  enforceSubdomainRouting,
  getMarketingRedirect,
} from "./app/lib/subdomain-guard.server.js";

let passed = 0;
let failed = 0;
const fails = [];

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    fails.push(`✗ ${label}\n     expected: ${e}\n     actual:   ${a}`);
  }
}

function ok(cond, label) {
  if (cond) passed++;
  else {
    failed++;
    fails.push(`✗ ${label}`);
  }
}

// Helper: build a fake Request with a given host + url path.
function req(host, path = "/") {
  return new Request(`https://placeholder${path}`, {
    headers: host ? { host } : {},
  });
}

// Helper: run enforceSubdomainRouting and capture thrown Response.
function runGuard(host, path) {
  try {
    enforceSubdomainRouting(req(host, path));
    return { thrown: false };
  } catch (e) {
    if (e instanceof Response) {
      return {
        thrown: true,
        status: e.status,
        location: e.headers.get("Location"),
      };
    }
    throw e;
  }
}

console.log("\n=== subdomain.server.js — parseHost / normalizeHost ===");

// normalizeHost: ports + IPv6
eq(normalizeHost("admin.luciteria.com:3000"), "admin.luciteria.com", "normalizeHost strips port");
eq(normalizeHost("LUCITERIA.COM"), "luciteria.com", "normalizeHost lowercases");
eq(normalizeHost("[::1]:3000"), "[::1]", "normalizeHost keeps IPv6 literal, strips port");
eq(normalizeHost(""), "", "normalizeHost empty");

// admin subdomain
{
  const r = parseHost("admin.luciteria.com");
  ok(r.isAdmin && !r.isApp && !r.isApex && !r.isLocal && !r.isUnknownHost, "admin.luciteria.com → isAdmin");
  eq(r.subdomain, "admin", "admin subdomain label");
}
// app subdomain (with port)
{
  const r = parseHost("app.luciteria.com:3000");
  ok(r.isApp && !r.isAdmin, "app.luciteria.com:3000 → isApp");
}
// apex
{
  const r = parseHost("luciteria.com");
  ok(r.isApex && !r.isAdmin && !r.isApp, "apex luciteria.com → isApex");
}
// www → treated as apex
{
  const r = parseHost("www.luciteria.com");
  ok(r.isApex && !r.isAdmin && !r.isApp, "www.luciteria.com → isApex");
  eq(r.subdomain, "www", "www subdomain label retained");
}
// deep subdomain admin.staging.luciteria.com → first label wins
{
  const r = parseHost("admin.staging.luciteria.com");
  ok(r.isAdmin, "admin.staging.luciteria.com → isAdmin (first label)");
}
// localhost / dev
ok(parseHost("localhost").isLocal, "localhost → isLocal");
ok(parseHost("localhost:3000").isLocal, "localhost:3000 → isLocal");
ok(parseHost("127.0.0.1").isLocal, "127.0.0.1 → isLocal");
ok(parseHost("192.168.1.50:3000").isLocal, "LAN IP → isLocal");
ok(parseHost("[::1]:3000").isLocal, "IPv6 loopback → isLocal");
ok(parseHost("myhost.local").isLocal, ".local → isLocal");
// empty host
ok(parseHost("").isLocal, "empty host → isLocal (safe)");
// unknown host (preview URL, not our root domain)
{
  const r = parseHost("abc123.preview.abacusai.app");
  ok(r.isUnknownHost && !r.isAdmin && !r.isApp && !r.isLocal, "preview host → isUnknownHost");
}
// different root domain configured
{
  const r = parseHost("admin.example.org", { rootDomain: "example.org" });
  ok(r.isAdmin, "custom rootDomain admin.example.org → isAdmin");
}
// custom subdomain labels
{
  const r = parseHost("dashboard.luciteria.com", { adminSubdomain: "dashboard" });
  ok(r.isAdmin, "custom adminSubdomain label");
}

console.log("=== guard — isAdminPath / isBypassPath ===");
ok(isAdminPath("/admin"), "/admin is admin path");
ok(isAdminPath("/admin/"), "/admin/ is admin path");
ok(isAdminPath("/admin/login"), "/admin/login is admin path");
ok(isAdminPath("/admin/users"), "/admin/users is admin path");
ok(!isAdminPath("/administrator"), "/administrator is NOT admin path");
ok(!isAdminPath("/app/admin"), "/app/admin (Shopify embedded) is NOT blocked admin path");
ok(!isAdminPath("/"), "/ is NOT admin path");
ok(isBypassPath("/build/entry.js"), "/build/* bypass");
ok(isBypassPath("/assets/x.css"), "/assets/* bypass");
ok(isBypassPath("/favicon.ico"), "favicon bypass");
ok(isBypassPath("/@vite/client"), "/@vite bypass");
ok(!isBypassPath("/admin/users"), "/admin/users not bypass");

console.log("=== guard — evaluateRoute (pure) ===");
const adminInfo = parseHost("admin.luciteria.com");
const appInfo = parseHost("app.luciteria.com");
const apexInfo = parseHost("luciteria.com");
const localInfo = parseHost("localhost");
const unknownInfo = parseHost("x.preview.abacusai.app");

// admin host
eq(evaluateRoute({ info: adminInfo, pathname: "/" }), { action: "redirect", to: "/admin/login", status: 302 }, "admin host / → redirect login");
eq(evaluateRoute({ info: adminInfo, pathname: "/app/cabinet" }), { action: "redirect", to: "/admin/login", status: 302 }, "admin host consumer path → redirect login");
eq(evaluateRoute({ info: adminInfo, pathname: "/admin/users" }), { action: "allow" }, "admin host /admin/users → allow");
eq(evaluateRoute({ info: adminInfo, pathname: "/admin/login" }), { action: "allow" }, "admin host /admin/login → allow");
eq(evaluateRoute({ info: adminInfo, pathname: "/favicon.ico" }), { action: "allow" }, "admin host favicon → allow");

// app host
eq(evaluateRoute({ info: appInfo, pathname: "/" }), { action: "allow" }, "app host / → allow");
eq(evaluateRoute({ info: appInfo, pathname: "/app/cabinet" }), { action: "allow" }, "app host consumer → allow");
eq(evaluateRoute({ info: appInfo, pathname: "/admin" }), { action: "notFound", status: 404 }, "app host /admin → 404");
eq(evaluateRoute({ info: appInfo, pathname: "/admin/users" }), { action: "notFound", status: 404 }, "app host /admin/users → 404");
eq(evaluateRoute({ info: appInfo, pathname: "/app/admin/operations" }), { action: "allow" }, "app host /app/admin/* (embedded) → allow");

// apex / local / unknown → allow everything
for (const [label, info] of [["apex", apexInfo], ["local", localInfo], ["unknown", unknownInfo]]) {
  eq(evaluateRoute({ info, pathname: "/" }), { action: "allow" }, `${label} / → allow`);
  eq(evaluateRoute({ info, pathname: "/admin/users" }), { action: "allow" }, `${label} /admin/users → allow`);
}

console.log("=== guard — enforceSubdomainRouting (thrown responses) ===");
// admin host
{
  const r = runGuard("admin.luciteria.com", "/");
  ok(r.thrown && r.status === 302 && r.location === "/admin/login", "admin / throws 302 → /admin/login");
}
{
  const r = runGuard("admin.luciteria.com", "/admin/login");
  ok(!r.thrown, "admin /admin/login does NOT throw (no loop)");
}
{
  const r = runGuard("admin.luciteria.com", "/admin/users");
  ok(!r.thrown, "admin /admin/users allowed");
}
// app host
{
  const r = runGuard("app.luciteria.com", "/admin");
  ok(r.thrown && r.status === 404, "app /admin throws 404");
}
{
  const r = runGuard("app.luciteria.com", "/app/cabinet");
  ok(!r.thrown, "app consumer route allowed");
}
// dev + unknown + apex never throw
{
  ok(!runGuard("localhost:3000", "/admin/users").thrown, "localhost /admin/users allowed");
  ok(!runGuard("localhost:3000", "/").thrown, "localhost / allowed");
  ok(!runGuard("x.preview.abacusai.app", "/admin").thrown, "preview /admin allowed");
  ok(!runGuard("luciteria.com", "/admin").thrown, "apex /admin allowed");
  ok(!runGuard("www.luciteria.com", "/").thrown, "www / allowed");
}
// missing host header → safe (allow)
{
  const r = runGuard(null, "/admin/users");
  ok(!r.thrown, "missing host header → allow (safe)");
}

console.log("=== getSubdomainInfo with FORCE_SUBDOMAIN ===");
{
  const prev = process.env.FORCE_SUBDOMAIN;
  process.env.FORCE_SUBDOMAIN = "admin";
  const info = getSubdomainInfo(req("localhost:3000", "/"));
  ok(info.isAdmin && info.forced, "FORCE_SUBDOMAIN=admin overrides localhost");
  process.env.FORCE_SUBDOMAIN = prev || "";
  if (!prev) delete process.env.FORCE_SUBDOMAIN;
}

console.log("=== marketing and policy redirects ===");
// getMarketingRedirect function tests
eq(getMarketingRedirect("/contact"), "https://luciteria.com/pages/contact", "contact page redirect");
eq(getMarketingRedirect("/CONTACT-US/"), "https://luciteria.com/pages/contact", "contact-us page redirect (normalized)");
eq(getMarketingRedirect("/es/contacto"), "https://luciteria.com/pages/contact", "es/contacto redirect");
eq(getMarketingRedirect("/about-us"), "https://luciteria.com", "about-us redirect");
eq(getMarketingRedirect("/sitemap.xml"), "https://luciteria.com/sitemap.xml", "sitemap redirect");
eq(getMarketingRedirect("/policies/privacy-policy"), "https://luciteria.com/policies/privacy-policy", "privacy policy prefix redirect");
eq(getMarketingRedirect("/products/element-cube-copper", "?v=1"), "https://luciteria.com/products/element-cube-copper?v=1", "products variant redirect");
eq(getMarketingRedirect("/app/cabinet"), null, "app cabinet path does NOT redirect");

// enforceSubdomainRouting thrown redirects
{
  const r = runGuard("app.luciteria.com", "/contact");
  ok(r.thrown && r.status === 301 && r.location === "https://luciteria.com/pages/contact", "app /contact throws 301 to storefront");
}
{
  const r = runGuard("luciteria.vercel.app", "/sitemap.xml");
  ok(r.thrown && r.status === 301 && r.location === "https://luciteria.com/sitemap.xml", "vercel /sitemap.xml throws 301 to storefront");
}
{
  const r = runGuard("admin.luciteria.com", "/legal");
  ok(r.thrown && r.status === 301 && r.location === "https://luciteria.com/policies/terms-of-service", "admin /legal throws 301 to terms of service");
}

console.log("\n──────────────────────────────────────");
if (failed === 0) {
  console.log(`✅ ALL TESTS PASSED — ${passed} assertions`);
} else {
  console.log(`❌ ${failed} FAILED, ${passed} passed`);
  console.log(fails.join("\n"));
  process.exitCode = 1;
}
