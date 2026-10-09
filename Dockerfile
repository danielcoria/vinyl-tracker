# ============================================================================
# Dockerfile: PACKS THE WHOLE APP INTO ONE "IMAGE" ANY HOST CAN RUN
#
# Built in three steps ("stages"); only the last one becomes the image:
#   deps   installs just what the server needs to RUN (no test or build tools)
#   build  installs everything and builds the server and website
#   (final) copies in only the finished pieces: small, and nothing extra
#
# The database lives on a separate permanent disk mounted at /data, so it
# survives updates and restarts. Settings come from the host (see .env.example):
#   APP_PASSWORD, DISCOGS_TOKEN, DISCOGS_USER_AGENT, TRUST_PROXY
#
# Build and run it:
#   docker build -t vinyl-tracker .
#   docker run -p 3000:3000 -v vinyl-data:/data -e APP_PASSWORD=... vinyl-tracker
# ============================================================================

FROM node:24-bookworm-slim AS base
WORKDIR /app
# Tools to compile the database library (better-sqlite3), in case npm builds it
# from source instead of using its ready-made copy. Only needed while installing.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
# Just the package lists first, so Docker can reuse the installed packages when
# only the code changes (much faster rebuilds).
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
COPY e2e/package.json e2e/

# ---------- deps: what the server needs at run time ----------
FROM base AS deps
RUN npm ci --omit=dev --workspace server

# ---------- build: compile the server and the website ----------
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# ---------- the image itself ----------
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/vinyl.db
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
# The database migrations: the server applies any new ones when it starts.
COPY --from=build /app/server/drizzle ./server/drizzle
COPY --from=build /app/client/dist ./client/dist

# Run as the image's ordinary "node" user, not as the all-powerful root user.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000

# Lets Docker (and hosts) see whether the app is healthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["node", "server/dist/index.js"]
