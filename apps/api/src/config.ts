import * as dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  webOrigin: process.env.WEB_ORIGIN || "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET || "dev-insecure-secret-change-me",
  dbPath: process.env.DB_PATH || path.join(process.cwd(), "data", "faceguard.sqlite"),
  uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"),
  searchProvider: (process.env.SEARCH_PROVIDER || "mock") as
    | "google_vision"
    | "tineye"
    | "mock",
  googleVisionApiKey: process.env.GOOGLE_VISION_API_KEY || "",
  tineyeApiUrl: process.env.TINEYE_API_URL || "https://api.tineye.com/rest/search/",
  tineyeApiKey: process.env.TINEYE_API_KEY || "",
  matchMinConfidence: parseFloat(process.env.MATCH_MIN_CONFIDENCE || "0.55"),
  // ---- AI face verification ----
  faceMatchEnabled: (process.env.FACE_MATCH_ENABLED || "true") !== "false",
  faceModelsDir: process.env.FACE_MODELS_DIR || path.join(process.cwd(), "models"),
  // Euclidean-distance threshold on 128-d descriptors. <=0.6 is the standard
  // "same person" cutoff for face-api recognition embeddings.
  faceMatchThreshold: parseFloat(process.env.FACE_MATCH_THRESHOLD || "0.6"),
  // How many of the top reverse-image candidates to fetch + face-verify per scan.
  faceVerifyMaxCandidates: parseInt(process.env.FACE_VERIFY_MAX_CANDIDATES || "20", 10),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
};
