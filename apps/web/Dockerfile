FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json apps/web/
RUN npm install --workspace apps/web
COPY apps/web apps/web
# Next inlines NEXT_PUBLIC_* at build time, so the API URL must be set here.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm --workspace apps/web run build

FROM node:22-bookworm-slim
WORKDIR /app/apps/web
ENV NODE_ENV=production
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/web/.next ./.next
COPY --from=build /app/apps/web/package.json ./
COPY --from=build /app/apps/web/next.config.js ./
COPY --from=build /app/apps/web/public ./public
EXPOSE 3000
CMD ["npx", "next", "start"]
