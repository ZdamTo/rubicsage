# syntax=docker/dockerfile:1
# ============================================================
# RubicSage – Production Docker image
# Multi-stage build: deps → builder → runner
#
# Vercel Container deployment:
#   vercel.json  →  "builds": [{ "src": "Dockerfile", "use": "@vercel/node" }]
#
# Self-hosted usage:
#   docker build -t rubicsage .
#   docker run -p 3000:3000 --env-file .env.local rubicsage
# ============================================================

# ── Stage 1: install dependencies ─────────────────────────────────────────────
FROM node:20-alpine AS deps

# Install libc compat for native modules (e.g. sharp, canvas)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy lockfiles first for better layer caching
COPY package.json package-lock.json ./

# Install production + dev deps (dev needed for the build step)
RUN npm ci

# ── Stage 2: build the Next.js app ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source
COPY . .

# Build-time public env vars (safe to bake in – these are anon/public keys)
# Override at runtime via docker run -e or --env-file if needed.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 3: minimal production image ─────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy only what Next.js standalone output needs
COPY --from=builder /app/public            ./public
COPY --from=builder /app/.next/standalone  ./
COPY --from=builder /app/.next/static      ./.next/static

# Copy rubric files used by the grading API (loaded from filesystem)
COPY --from=builder /app/rubrics           ./rubrics
COPY --from=builder /app/data              ./data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# next.config.mjs output:"standalone" produces server.js at the root
CMD ["node", "server.js"]
