// Dependency-free verification of the face-matching math (services/faceEngine.ts)
// and the tiered score-fusion ranking (services/faceVerification.ts).
import assert from "node:assert";

function descriptorDistance(a, b) {
  if (a.length !== b.length) return Infinity;
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}
function distanceToConfidence(distance, threshold) {
  return Math.max(0, Math.min(1, 1 - distance / (threshold * 2)));
}
function isSamePerson(distance, threshold) { return distance <= threshold; }
function fusedScore(m) {
  if (typeof m.faceConfidence === "number") return (m.faceVerified ? 2 : -1) + m.faceConfidence;
  return m.confidence;
}

const T = 0.6;

assert.equal(descriptorDistance([1, 2, 3], [1, 2, 3]), 0);
assert.equal(distanceToConfidence(0, T), 1);
assert.ok(isSamePerson(0, T));
assert.ok(isSamePerson(0.6, T));
assert.equal(Math.round(distanceToConfidence(0.6, T) * 100), 50);
assert.ok(!isSamePerson(0.9, T));
assert.equal(distanceToConfidence(1.2, T), 0);
assert.equal(descriptorDistance([1, 2], [1, 2, 3]), Infinity);

// Tiered ranking on a realistic mixed result set
const results = [
  { url: "img-only-high", confidence: 0.97 },                                  // unchecked image dup
  { url: "face-yes", confidence: 0.6, faceVerified: true, faceConfidence: 0.92 }, // confirmed face
  { url: "face-no", confidence: 0.9, faceVerified: false, faceConfidence: 0.08 }, // failed face check
  { url: "img-only-mid", confidence: 0.7 },                                    // unchecked image dup
];
const ranked = [...results].sort((a, b) => fusedScore(b) - fusedScore(a)).map((m) => m.url);
assert.deepEqual(ranked, ["face-yes", "img-only-high", "img-only-mid", "face-no"],
  "ranking should be: confirmed face > unchecked images > failed face");

console.log("FACE MATCH MATH + TIERED FUSION TESTS PASSED");
