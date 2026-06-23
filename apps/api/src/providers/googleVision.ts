import { FaceMatch } from "@faceguard/shared";
import { ReverseImageSearchProvider, SearchInput } from "./types";
import { config } from "../config";

/**
 * Google Cloud Vision WEB_DETECTION provider.
 *
 * This is the most defensible "find my own face online" backend: it surfaces
 * web pages and images where the user's submitted photo (or a visually similar
 * one) already appears publicly. It does NOT build or query a biometric
 * face-identity database, so it stays clear of the regulatory problems that
 * affect face-recognition identification services.
 *
 * Requires GOOGLE_VISION_API_KEY. Docs:
 * https://cloud.google.com/vision/docs/detecting-web
 */
export class GoogleVisionProvider implements ReverseImageSearchProvider {
  readonly name = "google_vision";

  async search(input: SearchInput): Promise<FaceMatch[]> {
    if (!config.googleVisionApiKey) {
      throw new Error("GOOGLE_VISION_API_KEY is not set");
    }

    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${config.googleVisionApiKey}`;
    const body = {
      requests: [
        {
          image: { content: input.imageBuffer.toString("base64") },
          features: [{ type: "WEB_DETECTION", maxResults: 50 }],
        },
      ],
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Vision error ${res.status}: ${text}`);
    }

    const data: any = await res.json();
    const web = data?.responses?.[0]?.webDetection || {};
    const matches: FaceMatch[] = [];
    const now = new Date().toISOString();

    // Full matches: same image found online.
    for (const m of web.fullMatchingImages || []) {
      matches.push({
        url: m.url,
        confidence: 0.95,
        kind: "full",
        provider: this.name,
        firstSeenAt: now,
      });
    }
    // Partial / cropped / edited variants.
    for (const m of web.partialMatchingImages || []) {
      matches.push({
        url: m.url,
        confidence: 0.78,
        kind: "partial",
        provider: this.name,
        firstSeenAt: now,
      });
    }
    // Pages that include a matching image.
    for (const p of web.pagesWithMatchingImages || []) {
      const thumb =
        p.fullMatchingImages?.[0]?.url || p.partialMatchingImages?.[0]?.url;
      matches.push({
        url: thumb || p.url,
        pageUrl: p.url,
        siteName: safeHost(p.url),
        thumbnailUrl: thumb,
        confidence: 0.7,
        kind: "page",
        provider: this.name,
        firstSeenAt: now,
      });
    }

    // De-duplicate by url, keep highest confidence.
    const byUrl = new Map<string, FaceMatch>();
    for (const m of matches) {
      const prev = byUrl.get(m.url);
      if (!prev || m.confidence > prev.confidence) byUrl.set(m.url, m);
    }
    return [...byUrl.values()];
  }
}

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
