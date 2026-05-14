FROM node:22-alpine AS builder
WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar config de monorepo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages/core/package.json packages/core/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

# Instalar dep con dev
RUN pnpm install --frozen-lockfile

# Copiar código fuente
COPY packages/core/src packages/core/src
COPY packages/core/tsconfig.json packages/core/
COPY packages/backend/src packages/backend/src
COPY packages/backend/tsconfig.json packages/backend/
COPY packages/frontend/ packages/frontend/

# Compilar
RUN cd packages/core && npx tsc && \
    cd /app/packages/frontend && npx vite build && \
    cd /app/packages/backend && npx tsc

# --- Runner stage: usar npm para evitar problemas de ESM con pnpm ---
FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=builder /app/packages/backend/dist /app/backend
COPY --from=builder /app/packages/frontend/dist /app/frontend

# Generar un package.json mínimo para npm
RUN echo '{"name":"emf-webapp","type":"module","dependencies":{}}' > /app/package.json

# Instalar dependencias con npm (resuelve correctamente ESM)
RUN npm install --save \
    @nestjs/common@latest \
    @nestjs/core@latest \
    @nestjs/platform-express@latest \
    @nestjs/typeorm@latest \
    reflect-metadata \
    rxjs \
    typeorm@latest \
    sqlite3@latest \
    better-sqlite3@latest

# Enlazar paquete core local
RUN mkdir -p /app/node_modules/@emf-webapp
COPY --from=builder /app/packages/core/dist /app/node_modules/@emf-webapp/core
RUN echo '{"name":"@emf-webapp/core","type":"module","main":"index.js"}' > /app/node_modules/@emf-webapp/core/package.json

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "backend/main.js"]
