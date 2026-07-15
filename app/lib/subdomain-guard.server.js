/**
 * Subdomain routing guard — server only.
 *
 * Enforces which URL paths are reachable on each subdomain so a single Remix
 * codebase can be deployed (or fronted) as two separate sites:
 *
 *   admin.luciteria.com
 *     - "/"                     → redirect to "/admin/login"
 *     - any non "/admin" path   → redirect to "/admin/login"
 *     - "/admin/*"              → allowed
 *
 *   app.luciteria.com
 *     - "/admin" or "/admin/*"  → 404 (admin is invisible on the consumer host)
 *     - everything else         → allowed
 *
 *   localhost / IPs / *.local / preview hosts / apex / www
 *     - everything allowed (routing rules NOT enforced)
 *
 * Usage (in app/root.jsx loader):
 *
 *   import { enforceSubdomainRouting } from "./lib/subdomain-guard.server.js";
 *   export const loader = async ({ request }) => {
 *     enforceSubdomainRouting(request);   // throws redirect / 404 when needed
 *     return json({ ... });
 *   };
 */
import { redirect } from "@remix-run/node";
import { getSubdomainInfo } from "./subdomain.server.js";

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_PATH_PREFIX = "/admin";

/**
 * Paths that must never be blocked/redirected regardless of subdomain.
 * These are framework/asset/system requests that occasionally hit a loader.
 */
const ALWAYS_ALLOW_PREFIXES = [
  "/build/", // Remix client build assets
  "/assets/", // Vite assets
  "/@", // Vite dev (/@vite, /@id, /@fs, /@react-refresh)
  "/node_modules/", // Vite dev module graph
  "/__manifest", // Remix route manifest
  "/.well-known/", // ACME / misc well-known endpoints
];

const ALWAYS_ALLOW_EXACT = new Set([
  "/favicon.ico",
  "/robots.txt",
]);

/**
 * Resolves a storefront redirect URL for legacy marketing / support / policy paths.
 * Returns the destination URL (with query parameters preserved) or null if no redirect.
 *
 * @param {string} pathname
 * @param {string} search
 * @returns {string|null}
 */
export function getMarketingRedirect(pathname, search = "") {
  let normalized = pathname.toLowerCase();
  if (normalized.endsWith("/") && normalized !== "/") {
    normalized = normalized.slice(0, -1);
  }

  const mappings = {
    "/sitemap.xml": "https://luciteria.com/sitemap.xml",
    "/contact": "https://luciteria.com/pages/contact",
    "/contact-us": "https://luciteria.com/pages/contact",
    "/contactus": "https://luciteria.com/pages/contact",
    "/contacto": "https://luciteria.com/pages/contact",
    "/contacto-us": "https://luciteria.com/pages/contact",
    "/es/contacto": "https://luciteria.com/pages/contact",
    "/en/contact": "https://luciteria.com/pages/contact",
    "/contato": "https://luciteria.com/pages/contact",
    "/kontakt": "https://luciteria.com/pages/contact",
    "/contatti": "https://luciteria.com/pages/contact",
    "/reach-us": "https://luciteria.com/pages/contact",
    "/get-in-touch": "https://luciteria.com/pages/contact",
    "/about": "https://luciteria.com",
    "/about-us": "https://luciteria.com",
    "/sobre-nosotros": "https://luciteria.com",
    "/nosotros": "https://luciteria.com",
    "/company": "https://luciteria.com",
    "/team": "https://luciteria.com",
    "/help": "https://luciteria.com/pages/faq",
    "/support": "https://luciteria.com/pages/faq",
    "/pricing": "https://luciteria.com/pages/faq",
    "/terms": "https://luciteria.com/policies/terms-of-service",
    "/legal": "https://luciteria.com/policies/terms-of-service",
    "/impressum": "https://luciteria.com/policies/terms-of-service",
    "/privacy": "https://luciteria.com/policies/privacy-policy",
  };

  if (mappings[normalized]) {
    return mappings[normalized] + search;
  }

  const prefixes = [
    "/policies/",
    "/pages/",
    "/collections/",
    "/products/",
    "/blogs/",
    "/cart",
    "/checkout",
  ];

  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      return `https://luciteria.com${pathname}${search}`;
    }
  }

  return null;
}

/**
 * Is the path a true /admin path? Matches "/admin" exactly and "/admin/...".
 * Critically does NOT match the Shopify-embedded consumer admin under "/app/admin".
 * @param {string} pathname
 */
export function isAdminPath(pathname) {
  return pathname === ADMIN_PATH_PREFIX || pathname.startsWith(ADMIN_PATH_PREFIX + "/");
}

/** Should this path bypass all routing rules (asset/system path)? */
export function isBypassPath(pathname) {
  if (ALWAYS_ALLOW_EXACT.has(pathname)) return true;
  return ALWAYS_ALLOW_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Pure routing decision. No request/throwing — fully unit-testable.
 *
 * @param {object} args
 * @param {object} args.info       result of parseHost/getSubdomainInfo
 * @param {string} args.pathname   request path (no querystring)
 * @returns {{ action: "allow" }
 *         | { action: "redirect", to: string, status: number }
 *         | { action: "notFound", status: number }}
 */
export function evaluateRoute({ info, pathname }) {
  // 1. Never interfere with asset/system paths.
  if (isBypassPath(pathname)) return { action: "allow" };

  // 2. Local dev, apex/www, and unknown (non-root-domain) hosts: allow all.
  if (!info || info.isLocal || info.isApex || info.isUnknownHost) {
    return { action: "allow" };
  }

  // 3. admin.luciteria.com — admin-only host.
  if (info.isAdmin) {
    if (isAdminPath(pathname)) return { action: "allow" };
    // Root and any other consumer path → push the operator to admin login.
    return { action: "redirect", to: ADMIN_LOGIN_PATH, status: 302 };
  }

  // 4. app.luciteria.com — consumer host, admin must be invisible.
  if (info.isApp) {
    if (isAdminPath(pathname)) return { action: "notFound", status: 404 };
    return { action: "allow" };
  }

  // 5. Any other recognised subdomain under the root domain (e.g. "staging",
  //    "beta"): treat like the consumer site but keep /admin reachable, since
  //    these are typically internal preview environments. Allow all.
  return { action: "allow" };
}

/**
 * Middleware entry point. Call from the root loader.
 * Throws a Response (redirect or 404) when the request must be diverted;
 * returns the subdomain info object otherwise.
 *
 * @param {Request} request
 * @returns {ReturnType<typeof getSubdomainInfo>}
 */
export function enforceSubdomainRouting(request) {
  const url = new URL(request.url);

  // Intercept legacy marketing, support, and policy paths and redirect to the storefront.
  const marketingRedirectUrl = getMarketingRedirect(url.pathname, url.search);
  if (marketingRedirectUrl) {
    throw redirect(marketingRedirectUrl, { status: 301 });
  }

  const info = getSubdomainInfo(request);
  const decision = evaluateRoute({ info, pathname: url.pathname });

  if (decision.action === "redirect") {
    // Avoid redirect loops if we're already at the target path.
    if (url.pathname !== decision.to) {
      throw redirect(decision.to, { status: decision.status });
    }
  } else if (decision.action === "notFound") {
    throw new Response("Not Found", { status: decision.status });
  }

  return info;
}
