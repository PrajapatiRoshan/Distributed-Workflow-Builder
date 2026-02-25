FROM node:20-slim AS builder
WORKDIR /app

# Install build tools
RUN npm install -g typescript

# Copy package files
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/dag-engine/package.json ./packages/dag-engine/
COPY services/auth/package.json ./services/auth/
COPY services/gateway/package.json ./services/gateway/
COPY services/plugin/package.json ./services/plugin/
COPY services/worker/package.json ./services/worker/
COPY services/workflow/package.json ./services/workflow/
COPY services/orchestrator/package.json ./services/orchestrator/
COPY services/ws-gateway/package.json ./services/ws-gateway/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy tsconfig files
COPY tsconfig.base.json ./
COPY packages/shared-types/tsconfig.json ./packages/shared-types/
COPY services/ws-gateway/tsconfig.json ./services/ws-gateway/

# Copy source files
COPY packages/shared-types/src ./packages/shared-types/src
COPY services/ws-gateway/src ./services/ws-gateway/src

# Build shared-types
WORKDIR /app/packages/shared-types
RUN tsc

# Build ws-gateway service
WORKDIR /app/services/ws-gateway
RUN tsc

FROM node:20-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN groupadd -r wfb && useradd -r -g wfb wfb
COPY --from=builder /app/services/ws-gateway/dist ./dist
COPY --from=builder /app/services/ws-gateway/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types/dist ./node_modules/@wfb/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./node_modules/@wfb/shared-types/
USER wfb
EXPOSE 3005
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD curl -f http://localhost:3005/health || exit 1
CMD ["node", "dist/server.js"]
