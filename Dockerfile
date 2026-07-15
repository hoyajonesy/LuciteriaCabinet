# ============================================================
# Luciteria Collector Cabinet — Production Dockerfile
# ============================================================
# Multi-stage build for minimal production image
#
# Build:  docker build -t luciteria-cabinet .
# Run:    docker run -p 3000:3000 --env-file .env luciteria-cabinet
# ============================================================

# --- Stage 1: Dependencies ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# --- Stage 2: Build ---
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Remix app
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# --- Stage 3: Production ---
FROM node:20-alpine AS production
WORKDIR /app

# Security: run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 remix
    
# Copy production artifacts
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/data ./data
COPY --from=build /app/public ./public

# Prisma needs the schema at runtime for migrations
# Data directory needs the CSV files for product catalog

ENV NODE_ENV=production
ENV APP_MODE=prototype
ENV PORT=3000

EXPOSE 3000

USER remix

# Run migrations then start
# TODO: In production, run migrations in a separate init container or CI step
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
