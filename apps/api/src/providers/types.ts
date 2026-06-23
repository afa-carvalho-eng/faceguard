import { FaceMatch } from "@faceguard/shared";

export interface SearchInput {
  imageBuffer: Buffer;
  mimeType: string;
}

export interface ReverseImageSearchProvider {
  readonly name: string;
  /**
   * Given an image of the user's own face, return places online where that
   * same image / likeness appears. Implementations MUST NOT persist the
   * image into any third-party biometric database.
   */
  search(input: SearchInput): Promise<FaceMatch[]>;
}
