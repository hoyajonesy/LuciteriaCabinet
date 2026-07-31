/**
 * Regression tests — format normalisation (Bug 1 foundation).
 *
 * The shop filter broke because raw stored size tokens ("10mm", "50mm", …)
 * were compared directly against canonical format ids ("10mm_cube", …).
 * normaliseFormat() is the single source of truth that unifies them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseFormat, formatLabel, parseSizes } from "../app/lib/formats.js";

test("normaliseFormat maps bare size tokens to canonical cube ids", () => {
  assert.equal(normaliseFormat("10mm"), "10mm_cube");
  assert.equal(normaliseFormat("25.4mm"), "25.4mm_cube");
  assert.equal(normaliseFormat("50mm"), "50mm_cube");
  assert.equal(normaliseFormat("2x2"), "lucite_cube");
  assert.equal(normaliseFormat("lucite"), "lucite_cube");
});

test("normaliseFormat handles ampoule spelling/plural variants", () => {
  assert.equal(normaliseFormat("ampoule"), "ampule");
  assert.equal(normaliseFormat("ampoules"), "ampule");
  assert.equal(normaliseFormat("ampules"), "ampule");
});

test("normaliseFormat is case-insensitive and trims", () => {
  assert.equal(normaliseFormat("  10MM  "), "10mm_cube");
  assert.equal(normaliseFormat("Other"), "other");
});

test("normaliseFormat leaves already-canonical ids unchanged", () => {
  for (const id of ["10mm_cube", "10mm_shards", "25.4mm_cube", "50mm_cube", "lucite_cube", "ampule", "other"]) {
    assert.equal(normaliseFormat(id), id);
  }
});

test("normaliseFormat returns null for empty input", () => {
  assert.equal(normaliseFormat(""), null);
  assert.equal(normaliseFormat(null), null);
  assert.equal(normaliseFormat(undefined), null);
});

test("formatLabel produces human labels for raw tokens", () => {
  assert.equal(formatLabel("10mm"), "10mm Cube");
  assert.equal(formatLabel("50mm"), "50mm Cube");
  assert.equal(formatLabel("ampoule"), "Ampoule");
});

test("parseSizes decodes JSON list metafields and single values", () => {
  assert.deepEqual(parseSizes('["10mm","50mm"]'), ["10mm", "50mm"]);
  assert.deepEqual(parseSizes("10mm"), ["10mm"]);
  assert.deepEqual(parseSizes(""), []);
});
