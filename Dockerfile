# syntax=docker/dockerfile:1

# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Runtime image using uv
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS runtime

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PIONEER_IP="10.1.1.199" \
    PIONEER_PORT=8102

# Install Python dependencies using uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy backend source code
COPY main.py ./

# Copy built frontend assets to frontend/dist for FastAPI SPA serving
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose HTTP port
EXPOSE 8099

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8099/health')" || exit 1

# Run FastAPI server
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8099"]
