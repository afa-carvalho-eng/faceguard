// Mirrors @faceguard/shared (kept local so the web app builds standalone).
export type PlanTier = "free" | "pro";
export interface User { id: string; email: string; displayName: string; plan: PlanTier; createdAt: string; }
export type MatchKind = "full" | "partial" | "page";
export interface FaceMatch {
  url: string; pageUrl?: string; siteName?: string; thumbnailUrl?: string;
  confidence: number; kind: MatchKind; provider: string; firstSeenAt?: string;
  faceVerified?: boolean; faceConfidence?: number;
}
export type ScanStatus = "pending" | "running" | "completed" | "failed";
export interface Scan {
  id: string; userId: string; status: ScanStatus; provider: string;
  matchCount: number; matches: FaceMatch[]; faceDetected?: boolean; error?: string; createdAt: string; completedAt?: string;
}
export interface Monitor {
  id: string; label: string; frequency: "daily" | "weekly" | "monthly";
  active: boolean; lastRunAt?: string; knownMatchUrls: string[]; createdAt: string;
}
export interface Alert {
  id: string; monitorId: string; match: FaceMatch; acknowledged: boolean; createdAt: string;
}
