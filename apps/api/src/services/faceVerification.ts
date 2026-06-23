import { FaceMatch } from "@faceguard/shared";
import { config } from "../config";
import {
  faceEngineReady,
  getDescriptor,
  descriptorDistance,
  distanceToConfidence,
  isSamePerson,
} from "./faceEngine";

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 8 * 1024 * 1024;

/** Fetch a remote candidate image with a timeout and a size cap. */
async function fetchImage(url: string): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "FaceGuard/1.0 (+self-monitoring)" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length <= MAX_BYTES ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface VerificationResult {
  faceDetectedInReference: boolean;
  matches: FaceMatch[];
}

/**
 * Confirms which candidate matches actually contain the user's face.
 *
 * Given the user's own reference image and the matches returned by reverse-image
 * search, this computes a face descriptor for the reference, then for the top N
 * candidates fetches the image, detects a face, and compares it to the reference.
 * Each match is annotated with `faceVerified` + `faceConfidence`. Results are
 * re-ranked by a fused score (face similarity weighted above image-duplicate
 * confidence) so the locations that truly show the user's face rise to the top.
 *
 * If the face engine is unavailable or no face is found in the reference, the
 * matches are returned unchanged (image-match-only behavior).
 */
export async function verifyOwnFace(
  referenceBuffer: Buffer,
  matches: FaceMatch[]
): Promise<VerificationResult> {
  if (!(await faceEngineReady())) {
    return { faceDetectedInReference: false, matches };
  }

  const reference = await getDescriptor(referenceBuffer);
  if (!reference) {
    // No detectable face in the user's photo — can't face-verify, keep as is.
    return { faceDetectedInReference: false, matches };
  }

  const threshold = config.faceMatchThreshold;
  const limit = config.faceVerifyMaxCandidates;

  const annotated = await Promise.all(
    matches.map(async (m, idx) => {
      if (idx >= limit) return m; // bound the work per scan
      const imgUrl = m.thumbnailUrl || m.url;
      if (!imgUrl) return m;
      const buf = await fetchImage(imgUrl);
      if (!buf) return m;
      const desc = await getDescriptor(buf);
      if (!desc) return { ...m, faceVerified: false, faceConfidence: 0 };
      const dist = descriptorDistance(reference, desc);
      return {
        ...m,
        faceVerified: isSamePerson(dist, threshold),
        faceConfidence: distanceToConfidence(dist, threshold),
      };
    })
  );

  annotated.sort((a, b) => fusedScore(b) - fusedScore(a));
  return { faceDetectedInReference: true, matches: annotated };
}

/**
 * Ranking score that tiers results so the precise signal wins:
 *   confirmed face   -> band [2,3]  (sorted by face confidence)
 *   not yet checked  -> band [~0.55,1] (image-match confidence; filtered floor)
 *   checked & failed -> band [-1,0]  (pushed to the bottom)
 * This guarantees a location confirmed to show the user's face always ranks
 * above an unverified image duplicate, and a failed face check sinks below both.
 */
export function fusedScore(m: FaceMatch): number {
  if (typeof m.faceConfidence === "number") {
    return (m.faceVerified ? 2 : -1) + m.faceConfidence;
  }
  return m.confidence;
}
