/**
 * Regression test — Bug 2: the profile route (avatar upload) must be
 * protected. An unauthenticated request to the action returns 401 and never
 * reaches storage or the database.
 *
 * The route module is a `.jsx` file with a top-level `await fetchElements118()`
 * (Shopify) side effect via `../data/elements.server`. To test the `action`
 * in isolation without a JSX loader or any network/DB, we bundle it with
 * esbuild: JSX is stripped, every app-relative import is replaced by an inert
 * stub whose `getUserId` resolves to `null` (i.e. unauthenticated), while the
 * real `@remix-run/node` `json()` is kept so we can assert on the Response.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import esbuild from "esbuild";

const ROUTE = path.resolve(import.meta.dirname, "../app/routes/app.cabinet.profile.jsx");

// A CJS Proxy module: any named/default import resolves to an async () => null.
// getUserId() therefore returns null, exercising the unauthenticated guard.
// CJS stub. esbuild's CJS→ESM interop copies own property names into the
// namespace, so we must advertise the members the route reads at module top
// (notably getUserId) via ownKeys/getOwnPropertyDescriptor. getUserId resolves
// to null → the action hits its unauthenticated guard before touching any
// other collaborator, so the remaining (uncopied) names are never invoked.
const STUB = `
const asyncNull = async () => null;
const target = function () {};
const stub = new Proxy(target, {
  get(_t, prop) {
    if (prop === "__esModule") return true;
    if (prop === "default") return stub;
    if (prop === "prototype") return target.prototype;
    return asyncNull;
  },
  ownKeys() { return ["prototype", "getUserId"]; },
  getOwnPropertyDescriptor(_t, prop) {
    if (prop === "prototype") return Object.getOwnPropertyDescriptor(target, "prototype");
    return { value: asyncNull, writable: true, enumerable: true, configurable: true };
  },
  apply() { return null; },
});
module.exports = stub;
`;

const stubAppImports = {
  name: "stub-app-imports",
  setup(build) {
    // Replace every relative (app) import with the inert stub above.
    build.onResolve({ filter: /^\.\.?\// }, () => ({ path: "app-stub", namespace: "stub" }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: STUB, loader: "js" }));
  },
};

async function loadRouteAction() {
  const result = await esbuild.build({
    entryPoints: [ROUTE],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    // Keep the real Remix json()/redirect() and React so the Response is genuine.
    external: ["@remix-run/node", "@remix-run/react", "react"],
    plugins: [stubAppImports],
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  // Write inside the repo so Node resolves the real @remix-run/node from node_modules.
  const tmp = path.resolve(import.meta.dirname, `.profile-route-${process.pid}-${Date.now()}.mjs`);
  fs.writeFileSync(tmp, code);
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    fs.unlinkSync(tmp);
  }
}

test("profile action returns 401 for an unauthenticated request", async () => {
  const mod = await loadRouteAction();
  const request = new Request("http://localhost/app/cabinet/profile", { method: "POST" });
  const res = await mod.action({ request });

  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.error, /not authenticated/i);
});
