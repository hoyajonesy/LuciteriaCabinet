/**
 * Subdomain detection utility — server only.
 *
 * Detects which subdomain a request arrived on so that the app can be served
 * as two logically separate deployments from a single codebase:
 *
 *   admin.luciteria.com  → internal Admin dashboard  (/admin/*)
 *   app.luciteria.com    → consumer Collector Cabinet (/, /app/*, /onboarding/*, …)
 *
 * The detection is deliberately tolerant of:
 *   - reverse-proxy headers (X-Forwarded-Host)
 *   - host ports (localhost:3000)
 *   - localhost / 127.0.0.1 / ::1 / *.local development hosts
 *   - bare IP addresses
 *   - preview / staging hosts that are NOT the configured root domain
 *   - apex + www (treated as "no subdomain")
 *
 * Configuration (all optional, sensible defaults):
 *   ROOT_DOMAIN        – registrable domain, default "luciteria.com"
 *   ADMIN_SUBDOMAIN    – admin label,        default "admin"
 *   APP_SUBDOMAIN      – consumer label,      default "app"
 *   FORCE_SUBDOMAIN    – override detection entirely (handy for local testing,
 *                        e.g. FORCE_SUBDOMAIN=admin npm run dev)
 */

export const ROOT_DOMAIN = (process.env.ROOT_DOMAIN || "luciteria.com").toLowerCase();
export const ADMIN_SUBDOMAIN = (process.env.ADMIN_SUBDOMAIN || "admin").toLowerCase();
export const APP_SUBDOMAIN = (process.env.APP_SUBDOMAIN || "app").toLowerCase();

// Hostnames that always mean "local development" → routing is not enforced.
const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

/**
 * Pull the request host from headers, preferring proxy-forwarded values.
 * @param {Request} request
 * @returns {string} raw host header value (may include a port), or ""
 */
export function getHost(request) {
  const headers = request?.headers;
  if (!headers) return "";
  // X-Forwarded-Host can be a comma-separated list when chained through proxies.
  const forwarded = headers.get("x-forwarded-host");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("host") || "";
}

/**
 * Normalise a raw host value into a bare lowercase hostname (no port).
 * @param {string} host
 * @returns {string}
 */
export function normalizeHost(host) {
  if (!host) return "";
  let h = host.trim().toLowerCase();
  // Strip a trailing port. IPv6 literals are wrapped in [...] so a colon inside
  // brackets is not a port separator — only strip when not bracketed.
  if (h.startsWith("[")) {
    // [::1]:3000 → [::1]
    const close = h.indexOf("]");
    if (close !== -1) h = h.slice(0, close + 1);
  } else if (h.includes(":")) {
    h = h.split(":")[0];
  }
  return h;
}

/** Is this hostname a bare IPv4 address? */
function isIpv4(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/**
 * Pure parser: given a hostname + root domain, work out the subdomain context.
 * No request / env access — fully unit-testable.
 *
 * @param {string} hostname  bare hostname (no port), any case
 * @param {object} [opts]
 * @param {string} [opts.rootDomain]
 * @param {string} [opts.adminSubdomain]
 * @param {string} [opts.appSubdomain]
 * @returns {{
 *   hostname: string,
 *   rootDomain: string,
 *   subdomain: string|null,   // first label, e.g. "admin", "app", "www", or null
 *   isAdmin: boolean,
 *   isApp: boolean,
 *   isApex: boolean,          // apex or www of the configured root domain
 *   isLocal: boolean,         // localhost / IP / *.local
 *   isUnknownHost: boolean,   // a real host, but NOT under the configured root domain
 * }}
 */
export function parseHost(hostname, opts = {}) {
  const rootDomain = (opts.rootDomain || ROOT_DOMAIN).toLowerCase();
  const adminSub = (opts.adminSubdomain || ADMIN_SUBDOMAIN).toLowerCase();
  const appSub = (opts.appSubdomain || APP_SUBDOMAIN).toLowerCase();

  const h = normalizeHost(hostname);

  const base = {
    hostname: h,
    rootDomain,
    subdomain: null,
    isAdmin: false,
    isApp: false,
    isApex: false,
    isLocal: false,
    isUnknownHost: false,
  };

  // Empty host → treat as local/unknown so routing is never enforced blindly.
  if (!h) {
    return { ...base, isLocal: true };
  }

  // Local development hosts.
  if (LOCAL_HOSTNAMES.has(h) || h.endsWith(".local") || h.endsWith(".localhost") || isIpv4(h)) {
    return { ...base, isLocal: true };
  }

  // Under the configured root domain?
  if (h === rootDomain) {
    // apex, e.g. "luciteria.com"
    return { ...base, isApex: true };
  }

  if (h.endsWith("." + rootDomain)) {
    const prefix = h.slice(0, h.length - rootDomain.length - 1); // strip ".luciteria.com"
    const firstLabel = prefix.split(".")[0]; // handle admin.staging.luciteria.com → "admin"

    if (firstLabel === "www" || firstLabel === "") {
      return { ...base, subdomain: firstLabel || null, isApex: true };
    }
    return {
      ...base,
      subdomain: firstLabel,
      isAdmin: firstLabel === adminSub,
      isApp: firstLabel === appSub,
    };
  }

  // A genuine host that is not under our root domain (preview URLs, staging on a
  // different domain, etc.) — don't enforce subdomain rules.
  return { ...base, isUnknownHost: true };
}

/**
 * Full request-aware detection. Honours FORCE_SUBDOMAIN for local testing.
 * @param {Request} request
 * @returns {ReturnType<typeof parseHost> & { forced: boolean }}
 */
export function getSubdomainInfo(request) {
  const forced = (process.env.FORCE_SUBDOMAIN || "").trim().toLowerCase();
  if (forced) {
    const info = parseHost(`${forced}.${ROOT_DOMAIN}`);
    return { ...info, forced: true };
  }
  const host = getHost(request);
  const info = parseHost(host);
  return { ...info, forced: false };
}

/**
 * Convenience: should subdomain routing rules be enforced for this request?
 * False for local dev, unknown hosts, and apex/www.
 */
export function shouldEnforceRouting(info) {
  return Boolean(info && (info.isAdmin || info.isApp));
}
