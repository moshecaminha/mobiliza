# MOBILIZA Backend — imagem produção
FROM node:20-alpine

WORKDIR /app

# Instala dependências (camada cacheável)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Copia código
COPY . .

# Usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mobiliza -u 1001 && \
    chown -R mobiliza:nodejs /app
USER mobiliza

EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget --quiet --tries=1 --spider http://localhost:3001/api/status || exit 1

CMD ["sh", "-c", "node migrate.js && node server.js"]
