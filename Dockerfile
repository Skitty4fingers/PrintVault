# ---- PrintVault production image (multi-stage) ------------------------------
# Stage 1: build the React/Vite client into static files.
FROM node:20-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: install server production dependencies.
# better-sqlite3 is a native module; the build tools below let it compile
# reliably if a prebuilt binary isn't available. These tools live only in this
# builder stage — the runtime image just copies the compiled node_modules.
FROM node:20-bookworm-slim AS server-deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package*.json ./
# Build native modules from source directly. This skips prebuild-install's
# network download (which can stall in restricted build environments) and is
# deterministic since the toolchain above is present.
RUN npm_config_build_from_source=true npm ci --omit=dev

# Stage 3: minimal runtime image.
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Server code + its production node_modules.
COPY server/ ./server/
COPY --from=server-deps /app/server/node_modules ./server/node_modules
# Built client assets (served by Express in production).
COPY --from=client-build /app/client/dist ./client/dist

# Persistent data lives here (mounted as a volume). Owned by the node user.
RUN mkdir -p /data && chown -R node:node /data /app
ENV STORAGE_PATH=/data \
    HOST=0.0.0.0 \
    PORT=8080

USER node
EXPOSE 8080

# Container-level healthcheck against the API.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
