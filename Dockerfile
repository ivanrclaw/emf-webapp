FROM node:22-alpine
WORKDIR /app

# Copiar archivos de dependencias primero (caching)
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/

# Instalar con npm ci (reproducible y más rápido)
RUN npm ci

# Copiar todo el código fuente
COPY packages/core/src packages/core/src
COPY packages/core/tsconfig.json packages/core/
COPY packages/backend/src packages/backend/src
COPY packages/backend/tsconfig.json packages/backend/
COPY packages/frontend/src packages/frontend/src
COPY packages/frontend/index.html packages/frontend/
COPY packages/frontend/vite.config.ts packages/frontend/
COPY packages/frontend/tsconfig.json packages/frontend/

# Compilar en orden: core → frontend → backend
RUN cd packages/core && npx tsc && \
    cd /app/packages/frontend && npx vite build && \
    cd /app/packages/backend && npx tsc

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "packages/backend/dist/main.js"]
