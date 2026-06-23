import Jimp from "jimp";

// Pure-JavaScript image handling (jimp) — no native build step required.

export interface FaceValidationResult {
  ok: boolean;
  reason?: string;
  width?: number;
  height?: number;
}

const SUPPORTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/bmp",
  "image/tiff",
  "image/gif",
];

/**
 * Validates that an uploaded file is a usable face photo before we spend a
 * search on it. This decodes the image and checks basic quality constraints.
 *
 * NOTE: a dedicated face-detection model (see services/faceEngine.ts) further
 * confirms a real face downstream; this is the cheap pre-check.
 */
export async function validateFacePhoto(
  buffer: Buffer
): Promise<FaceValidationResult> {
  let img: Jimp;
  try {
    img = await Jimp.read(buffer);
  } catch {
    return { ok: false, reason: "File is not a readable image." };
  }

  const mime = img.getMIME();
  if (!SUPPORTED_MIME.includes(mime)) {
    return { ok: false, reason: "Unsupported image format." };
  }

  const width = img.bitmap.width;
  const height = img.bitmap.height;
  if (width < 200 || height < 200) {
    return {
      ok: false,
      reason: "Image too small — use a photo at least 200×200px.",
    };
  }
  const ratio = width / height;
  if (ratio < 0.3 || ratio > 3) {
    return { ok: false, reason: "Unusual aspect ratio — use a normal photo." };
  }
  return { ok: true, width, height };
}

/** Normalize to a reasonable size/format to send to the search provider. */
export async function normalizeForSearch(buffer: Buffer): Promise<Buffer> {
  const img = await Jimp.read(buffer);
  // Fit within 1024×1024 without enlarging, then encode JPEG at quality 88.
  if (img.bitmap.width > 1024 || img.bitmap.height > 1024) {
    img.scaleToFit(1024, 1024);
  }
  img.quality(88);
  return img.getBufferAsync(Jimp.MIME_JPEG);
}
