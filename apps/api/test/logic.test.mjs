// Dependency-free verification of the two most error-prone pieces of logic:
// (1) Google Vision WEB_DETECTION -> FaceMatch[] mapping
// (2) match filtering + confidence sort used before returning a scan.
import assert from "node:assert";

// --- replicate googleVision parsing (kept in sync with src/providers/googleVision.ts) ---
function safeHost(url) { try { return new URL(url).hostname; } catch { return undefined; } }
function parseVision(web, providerName = "google_vision") {
  const matches = [];
  for (const m of web.fullMatchingImages || []) matches.push({ url: m.url, confidence: 0.95, kind: "full", provider: providerName });
  for (const m of web.partialMatchingImages || []) matches.push({ url: m.url, confidence: 0.78, kind: "partial", provider: providerName });
  for (const p of web.pagesWithMatchingImages || []) {
    const thumb = p.fullMatchingImages?.[0]?.url || p.partialMatchingImages?.[0]?.url;
    matches.push({ url: thumb || p.url, pageUrl: p.url, siteName: safeHost(p.url), thumbnailUrl: thumb, confidence: 0.7, kind: "page", provider: providerName });
  }
  const byUrl = new Map();
  for (const m of matches) { const prev = byUrl.get(m.url); if (!prev || m.confidence > prev.confidence) byUrl.set(m.url, m); }
  return [...byUrl.values()];
}

// --- replicate scanService filter+sort ---
function finalize(raw, minConfidence) {
  return raw.filter((m) => m.confidence >= minConfidence && m.url).sort((a, b) => b.confidence - a.confidence);
}

// Test 1: Vision mapping + dedupe (same url appears as full + page -> keep full @0.95)
const visionSample = {
  fullMatchingImages: [{ url: "https://site.test/me.jpg" }],
  partialMatchingImages: [{ url: "https://other.test/crop.jpg" }],
  pagesWithMatchingImages: [
    { url: "https://site.test/profile", fullMatchingImages: [{ url: "https://site.test/me.jpg" }] },
  ],
};
const parsed = parseVision(visionSample);
const me = parsed.find((m) => m.url === "https://site.test/me.jpg");
assert.equal(me.confidence, 0.95, "dedupe should keep highest confidence");
assert.ok(parsed.some((m) => m.kind === "partial" && m.confidence === 0.78));
assert.equal(parsed.find((m) => m.kind === "partial").url, "https://other.test/crop.jpg");

// Test 2: filter drops below-threshold and sorts desc
const finalized = finalize(
  [
    { url: "a", confidence: 0.4 },
    { url: "b", confidence: 0.9 },
    { url: "c", confidence: 0.6 },
    { url: "", confidence: 0.99 }, // no url -> dropped
  ],
  0.55
);
assert.deepEqual(finalized.map((m) => m.url), ["b", "c"], "filter+sort incorrect");

// Test 3: empty web detection -> no matches, no throw
assert.deepEqual(parseVision({}), []);

console.log("ALL LOGIC TESTS PASSED (" + parsed.length + " parsed matches, " + finalized.length + " after filter)");
