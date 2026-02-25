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
COPY packages/dag-engine/tsconfig.json ./packages/dag-engine/
COPY services/worker/tsconfig.json ./services/worker/

# Copy source files
COPY packages/shared-types/src ./packages/shared-types/src
COPY packages/dag-engine/src ./packages/dag-engine/src
COPY services/worker/src ./services/worker/src

# Build shared-types
WORKDIR /app/packages/shared-types
RUN tsc

# Build dag-engine
WORKDIR /app/packages/dag-engine
RUN tsc

# Build worker service
WORKDIR /app/services/worker
RUN tsc

FROM node:20-slim AS runner
WORKDIR /app
# Worker needs to run as root to access Docker socket
COPY --from=builder /app/services/worker/dist ./dist
COPY --from=builder /app/services/worker/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types/dist ./node_modules/@wfb/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./node_modules/@wfb/shared-types/
COPY --from=builder /app/packages/dag-engine/dist ./node_modules/@wfb/dag-engine/dist
COPY --from=builder /app/packages/dag-engine/package.json ./node_modules/@wfb/dag-engine/
CMD ["node", "dist/worker.js"]
