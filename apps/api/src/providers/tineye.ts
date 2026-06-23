import { FaceMatch } from "@faceguard/shared";
import { ReverseImageSearchProvider, SearchInput } from "./types";
import { config } from "../config";

/**
 * TinEye Commercial reverse-image-search provider.
 * Finds exact and modified copies of the submitted image across the web.
 * Requires TINEYE_API_KEY. Docs: https://services.tineye.com/developers/tineyeapi/
 */
export class TinEyeProvider implements ReverseImageSearchProvider {
  readonly name = "tineye";

  async search(input: SearchInput): Promise<FaceMatch[]> {
    if (!config.tineyeApiKey) {
      throw new Error("TINEYE_API_KEY is not set");
    }

    const form = new FormData();
    const blob = new Blob([input.imageBuffer], { type: input.mimeType });
    form.append("image_upload", blob, "query.jpg");
    form.append("limit", "50");

    const res = await fetch(config.tineyeApiUrl, {
      method: "POST",
      headers: { "X-API-Key": config.tineyeApiKey },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TinEye error ${res.status}: ${text}`);
    }

    const data: any = await res.json();
    const results = data?.results?.matches || [];
    const now = new Date().toISOString();

    return results.map((m: any): FaceMatch => {
      const backlink = m.backlinks?.[0] || {};
      return {
        url: backlink.url || m.image_url,
        pageUrl: backlink.backlink,
        siteName: backlink.crawl_date ? safeHost(backlink.backlink) : undefined,
        thumbnailUrl: m.image_url,
        // TinEye returns exact/near-duplicate copies -> high confidence.
        confidence: typeof m.score === "number" ? Math.min(1, m.score / 100) : 0.9,
        kind: "full",
        provider: this.name,
        firstSeenAt: now,
      };
    });
  }
}

function safeHost(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}
