# ==============================================================================
# Class1Dev MCP Server - Production Containerfile (Debian Bookworm)
# Multi-stage build with Node.js 22 runtime and Python 3.11+ environment
# ==============================================================================

# Stage 1: Build TypeScript bundle
FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json nitrostack.config.ts ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production runtime
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHONUNBUFFERED=1
ENV PYTHONUTF8=1
ENV CLASS1_PYTHON_PATH="/app/.venv/bin/python3"
ENV PATH="/app/.venv/bin:$PATH"

# Install Debian pinned Python 3 runtime, venv, and curl for healthcheck
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      python3-venv \
      curl && \
    rm -rf /var/lib/apt/lists/*

# Install production Node dependencies
COPY package*.json ./
RUN npm ci --only=production

# Set up Python virtual environment and install pinned Class1 engine
COPY requirements-class1.txt ./
RUN python3 -m venv /app/.venv && \
    /app/.venv/bin/pip install --no-cache-dir -r requirements-class1.txt

# Copy compiled artifacts and Python wrapper
COPY --from=builder /app/dist ./dist
COPY python/ ./python/

# Security: Run as non-root unprivileged user
RUN chown -R node:node /app
USER node

# Container Healthcheck verifying live /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "dist/index.js"]
