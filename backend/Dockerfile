FROM node:22-alpine AS builder

ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_PROXY=

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm config set registry "${NPM_REGISTRY}" \
    && if [ -n "${NPM_PROXY}" ]; then npm config set proxy "${NPM_PROXY}" && npm config set https-proxy "${NPM_PROXY}"; fi \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci --prefer-offline --no-audit

COPY backend backend
COPY prisma prisma

RUN npm run prisma:generate --workspace backend
RUN npm run build --workspace backend
RUN npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

COPY --from=builder /app/backend/dist backend/dist
COPY --from=builder /app/backend/scripts backend/scripts
COPY --from=builder /app/backend/nest-cli.json backend/nest-cli.json
COPY --from=builder /app/prisma prisma
COPY --from=builder /app/node_modules node_modules

RUN mkdir -p backend/storage

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "backend"]
