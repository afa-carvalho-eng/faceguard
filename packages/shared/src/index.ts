// Shared types used across the API, web and mobile apps.

export type PlanTier = "free" | "pro";

export interface User {
  id: string;
  email: string;
  displayName: string;
  plan: PlanTier;
  createdAt: string;
}

/**
 * A consent record is required before ANY face scan can run.
 * The product only searches for the user's OWN likeness, so every scan
 * must be tied to an explicit, logged attestation of ownership + consent.
 */
export interface ConsentRecord {
  id: string;
  userId: string;
  // The user attests the photo is of themselves and they consent to the search.
  ownPhotoAttested: boolean;
  termsAccepted: boolean;
  ipAddress?: string;
  createdAt: string;
}

export type MatchKind = "full" | "partial" | "page";

export interface FaceMatch {
  // Where the image / likeness was found.
  url: string;
  pageUrl?: string;
  siteName?: string;
  thumbnailUrl?: string;
  // 0..1 confidence that this is the same image/likeness as the query.
  confidence: number;
  kind: MatchKind;
  provider: string;
  firstSeenAt?: string;
  // ---- AI face verification (against the user's own consented reference) ----
  // Whether the candidate image was confirmed to contain the user's face.
  faceVerified?: boolean;
  // 0..1 face-similarity confidence (higher = more certain it's the same face).
  faceConfidence?: number;
}

export type ScanStatus = "pending" | "running" | "completed" | "failed";

export interface Scan {
  id: string;
  userId: string;
  consentId: string;
  status: ScanStatus;
  // Whether a usable face was detected in the user's submitted photo.
  faceDetected?: boolean;
  imageRef: string; // stored reference, never the raw biometric
  provider: string;
  matchCount: number;
  matches: FaceMatch[];
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Monitor {
  id: string;
  userId: string;
  label: string;
  imageRef: string;
  consentId: string;
  // How often a background scan runs.
  frequency: "daily" | "weekly" | "monthly";
  active: boolean;
  lastRunAt?: string;
  knownMatchUrls: string[]; // baseline to diff against for "new appearance" alerts
  createdAt: string;
}

export interface Alert {
  id: string;
  userId: string;
  monitorId: string;
  match: FaceMatch;
  acknowledged: boolean;
  createdAt: string;
}

// ---- API request / response contracts ----

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CreateScanRequest {
  ownPhotoAttested: boolean;
  termsAccepted: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
}

export const PLAN_LIMITS: Record<PlanTier, { scansPerMonth: number; monitors: number }> = {
  free: { scansPerMonth: 3, monitors: 0 },
  pro: { scansPerMonth: 200, monitors: 10 },
};
