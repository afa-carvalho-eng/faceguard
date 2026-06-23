import { FaceMatch } from "@faceguard/shared";
import { ReverseImageSearchProvider, SearchInput } from "./types";

/**
 * Deterministic mock provider for local development and CI.
 * Returns plausible, clearly-fake results so the full UX works without keys.
 */
export class MockProvider implements ReverseImageSearchProvider {
  readonly name = "mock";

  async search(_input: SearchInput): Promise<FaceMatch[]> {
    const now = new Date().toISOString();
    return [
      {
        url: "https://example-social.test/u/janedoe/photo/1.jpg",
        pageUrl: "https://example-social.test/u/janedoe",
        siteName: "ExampleSocial",
        thumbnailUrl: "https://example-social.test/u/janedoe/photo/1_thumb.jpg",
        confidence: 0.97,
        kind: "full",
        provider: this.name,
        firstSeenAt: now,
      },
      {
        url: "https://photos.example.test/album/42/img-1184.jpg",
        pageUrl: "https://photos.example.test/album/42",
        siteName: "ExamplePhotos",
        confidence: 0.81,
        kind: "partial",
        provider: this.name,
        firstSeenAt: now,
      },
      {
        url: "https://news.example.test/2024/charity-run",
        pageUrl: "https://news.example.test/2024/charity-run",
        siteName: "Example News",
        confidence: 0.63,
        kind: "page",
        provider: this.name,
        firstSeenAt: now,
      },
    ];
  }
}
