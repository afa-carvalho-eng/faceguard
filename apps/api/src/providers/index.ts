import { config } from "../config";
import { ReverseImageSearchProvider } from "./types";
import { MockProvider } from "./mock";
import { GoogleVisionProvider } from "./googleVision";
import { TinEyeProvider } from "./tineye";

export function getProvider(): ReverseImageSearchProvider {
  switch (config.searchProvider) {
    case "google_vision":
      return new GoogleVisionProvider();
    case "tineye":
      return new TinEyeProvider();
    case "mock":
    default:
      return new MockProvider();
  }
}

export * from "./types";
