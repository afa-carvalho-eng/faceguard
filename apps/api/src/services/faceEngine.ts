import { config } from "../config";

/**
 * AI face engine — detection + 128-d face embeddings + similarity.
 *
 * SCOPE: this engine is used only to confirm the *user's own* face (from their
 * consented reference photo) against a bounded set of candidate images that a
 * reverse-image search already surfaced for that user. It is NOT a web-wide
 * face-identification index and must never be pointed at arbitrary third parties.
 *
 * It loads lazily and degrades gracefully: if the models or native deps aren't
 * present, every call returns null and the app falls back to image-match-only
 * results (so the product still runs with zero ML setup).
 */
let tf: any;
let faceapi: any;
let loadPromise: Promise<boolean> | null = null;

async function ensureLoaded(): Promise<boolean> {
  if (!config.faceMatchEnabled) return false;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      tf = require("@tensorflow/tfjs-node");
      faceapi = require("@vladmandic/face-api");
      const dir = config.faceModelsDir;
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(dir);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(dir);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(dir);
      console.log("[faceEngine] models loaded from", dir);
      return true;
    } catch (e: any) {
      console.warn(
        "[faceEngine] disabled (models/deps unavailable):",
        e?.message || e
      );
      return false;
    }
  })();
  return loadPromise;
}

export async function faceEngineReady(): Promise<boolean> {
  return ensureLoaded();
}

/**
 * Detect the single most prominent face in an image and return its 128-d
 * descriptor, or null if no usable face is found / engine unavailable.
 */
export async function getDescriptor(buffer: Buffer): Promise<number[] | null> {
  if (!(await ensureLoaded())) return null;
  let tensor: any;
  try {
    tensor = tf.node.decodeImage(buffer, 3);
    const det = await faceapi
      .detectSingleFace(tensor)
      .withFaceLandmarks()
      .withFaceDescriptor();
    return det ? Array.from(det.descriptor as Float32Array) : null;
  } catch {
    return null;
  } finally {
    if (tensor) tf.dispose(tensor);
  }
}

/** Euclidean distance between two descriptors (lower = more similar). */
export function descriptorDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Map a descriptor distance to a 0..1 face-match confidence. Distance 0 -> 1.0,
 * distance == 2*threshold -> 0. Clamped. Monotonic and threshold-relative so it
 * tracks the configured "same person" cutoff.
 */
export function distanceToConfidence(distance: number, threshold: number): number {
  const conf = 1 - distance / (threshold * 2);
  return Math.max(0, Math.min(1, conf));
}

export function isSamePerson(distance: number, threshold: number): boolean {
  return distance <= threshold;
}
