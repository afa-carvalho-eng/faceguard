# Deploying FaceGuard to a public URL (Render)

This gets the full product — including the AI face-confidence layer — running on a real
server you can open from any browser. It sidesteps your locked-down laptop entirely: Render
builds the Docker images in the cloud, so nothing compiles on your machine.

## What you need
- A GitHub (or GitLab) account with this `faceguard` repo pushed to it.
- A Render account (https://render.com) — free to create.
- A Google Cloud Vision API key (for real web results). See "Get a Vision key" below.

## Steps

1. **Push the repo** to GitHub if it isn't already.

2. **Create the services from the blueprint.** In Render: New → Blueprint → connect the repo.
   Render reads `render.yaml` and creates two web services: `faceguard-api` and `faceguard-web`.

3. **First deploy** will start. Let `faceguard-api` finish; copy its public URL
   (e.g. `https://faceguard-api.onrender.com`).

4. **Set the env vars** that are marked "sync: false" (Render will prompt for them):
   - On `faceguard-api`:
     - `GOOGLE_VISION_API_KEY` = your Vision key
     - `WEB_ORIGIN` = the web service URL (fill in after step 6, then redeploy)
   - On `faceguard-web`:
     - `NEXT_PUBLIC_API_URL` = the `faceguard-api` URL from step 3

5. **Redeploy `faceguard-web`** so it picks up `NEXT_PUBLIC_API_URL` (Next bakes it at build time).

6. Copy the `faceguard-web` URL, put it in `faceguard-api`'s `WEB_ORIGIN`, and redeploy the API
   (this lets the browser call the API without CORS errors).

7. Open the `faceguard-web` URL, sign up, upload a photo of **yourself**, accept consent, and scan.
   You'll get real pages/social URLs where that image appears, each with an image-match percentage,
   and — because the models are baked into the API image — a face-match percentage confirming it's you.

## Get a Vision key
1. https://console.cloud.google.com → create a project.
2. Enable the **Cloud Vision API** for that project.
3. APIs & Services → Credentials → Create credentials → **API key**. Copy it (`AIza...`).
   Free tier covers ~1,000 scans/month. Optionally restrict the key to the Vision API.

## Notes
- **Persistence:** `render.yaml` attaches a 1 GB disk to the API for the SQLite DB + uploads, so
  accounts and scan history survive restarts. The disk requires Render's paid (Starter) plan; on the
  free plan, drop the `disk:` block and data resets on redeploy.
- **Seeding demo accounts** on the server: open the `faceguard-api` Shell in Render and run
  `node apps/api/scripts/seed.mjs`.
- **Provider:** `render.yaml` sets `SEARCH_PROVIDER=google_vision`. To run without a key first
  (placeholder demo data), change it to `mock`.
- **Scope reminder:** this finds where *your provided image* appears (reverse-image search) and
  confirms your face in those results. It does not — by design — search the web to identify a person
  by face across photos they didn't post. See the README "Scope, on purpose" note.
