# qietr-indexer poller — multi-stage build.
# Build context is this directory (qietr-indexer/poller).
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
# SOLANA_RPC_URL, DATABASE_URL, PROGRAM_ID come from the runtime environment.
CMD ["node", "dist/index.js"]
