# Build the API together with the shared types package.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm install
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build:shared && npm --workspace apps/api run build
# Download the AI face models so face verification is active on the server.
# Non-fatal: if it fails, the app still runs with image-match-only results.
RUN mkdir -p apps/api/models && (npm --workspace apps/api run fetch-models || echo "face models skipped")

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/models ./apps/api/models
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
