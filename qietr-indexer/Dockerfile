# Combined indexer API + poller in one container (for Koyeb's single free
# service, or any one-service host). Build context is this directory
# (qietr-indexer). For separate deploys, use api/Dockerfile or poller/Dockerfile.

FROM node:20-slim AS build
WORKDIR /app

# --- API build ---
COPY api/package.json api/package-lock.json* ./api/
RUN cd api && npm install --no-audit --no-fund
COPY api/tsconfig.json ./api/
COPY api/src ./api/src
RUN cd api && npm run build

# --- Poller build ---
COPY poller/package.json poller/package-lock.json* ./poller/
RUN cd poller && npm install --no-audit --no-fund
COPY poller/tsconfig.json ./poller/
COPY poller/src ./poller/src
RUN cd poller && npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production deps for both packages.
COPY api/package.json api/package-lock.json* ./api/
RUN cd api && npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY poller/package.json poller/package-lock.json* ./poller/
RUN cd poller && npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/api/dist ./api/dist
COPY --from=build /app/poller/dist ./poller/dist
COPY serve.mjs ./serve.mjs

# Koyeb injects $PORT; the API reads it (defaults to 4040 locally).
EXPOSE 4040
CMD ["node", "serve.mjs"]
