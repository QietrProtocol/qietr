# qietr-indexer API — multi-stage build.
# Build context is this directory (qietr-indexer/api).
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
# DATABASE_URL, PORT, CORS_ORIGINS, PGSSL come from the runtime environment.
EXPOSE 4040
CMD ["node", "dist/index.js"]
