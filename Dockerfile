FROM node:22-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos de dependencias primero (caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

# Instalar TODO con shamefully-hoist para que node_modules sea plano
RUN pnpm install --frozen-lockfile --shamefully-hoist

# Copiar todo el código fuente
COPY packages/core/src packages/core/src
COPY packages/core/tsconfig.json packages/core/
COPY packages/backend/src packages/backend/src
COPY packages/backend/tsconfig.json packages/backend/
COPY packages/frontend/src packages/frontend/src
COPY packages/frontend/index.html packages/frontend/
COPY packages/frontend/vite.config.ts packages/frontend/
COPY packages/frontend/tsconfig.json packages/frontend/

# Compilar
RUN cd packages/core && npx tsc && \
    cd /app/packages/frontend && npx vite build && \
    cd /app/packages/backend && npx tsc

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "packages/backend/dist/main.js"]
