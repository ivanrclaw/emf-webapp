FROM node:22-alpine
WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar todo el monorepo
COPY . .

# Instalar TODAS las dependencias (incluye dev)
RUN pnpm install --frozen-lockfile

# Compilar
RUN cd packages/core && npx tsc && \
    cd /app/packages/frontend && npx vite build && \
    cd /app/packages/backend && npx tsc

# Directorio de datos
RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "packages/backend/dist/main.js"]
