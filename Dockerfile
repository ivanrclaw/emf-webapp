# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos de configuración del monorepo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages/core/package.json packages/core/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar código fuente
COPY packages/core/src packages/core/src
COPY packages/core/tsconfig.json packages/core/
COPY packages/backend/src packages/backend/src
COPY packages/backend/tsconfig.json packages/backend/
COPY packages/frontend/src packages/frontend/src
COPY packages/frontend/index.html packages/frontend/
COPY packages/frontend/vite.config.ts packages/frontend/
COPY packages/frontend/tsconfig.json packages/frontend/

# Compilar todo
RUN cd packages/core && npx tsc && \
    cd /app/packages/frontend && npx vite build && \
    cd /app/packages/backend && npx tsc

# Stage 2: Producción
FROM node:22-alpine AS runner
WORKDIR /app

# Copiar dependencias de producción
COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/packages/backend/package.json packages/backend/
COPY --from=builder /app/packages/frontend/package.json packages/frontend/

RUN corepack enable && corepack prepare pnpm@latest --activate && \
    pnpm install --frozen-lockfile

# Crear directorio de datos para SQLite
RUN mkdir -p /app/data

# Copiar builds
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/backend/dist packages/backend/dist
COPY --from=builder /app/packages/frontend/dist packages/frontend/dist

EXPOSE 3000
CMD ["node", "packages/backend/dist/main.js"]
