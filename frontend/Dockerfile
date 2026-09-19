FROM node:22-alpine AS builder

WORKDIR /app

ARG BACKEND_ORIGIN=http://backend:3000
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_PROXY=
ENV BACKEND_ORIGIN=${BACKEND_ORIGIN}

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

COPY frontend frontend

RUN npm run build --workspace frontend

FROM node:22-alpine AS runner

WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_PROXY=
ENV NODE_ENV=production
ENV BACKEND_ORIGIN=http://backend:3000

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm config set registry "${NPM_REGISTRY}" \
    && if [ -n "${NPM_PROXY}" ]; then npm config set proxy "${NPM_PROXY}" && npm config set https-proxy "${NPM_PROXY}"; fi \
    && npm ci --omit=dev --prefer-offline --no-audit

COPY --from=builder /app/frontend/.next frontend/.next
COPY --from=builder /app/frontend/public frontend/public
COPY --from=builder /app/frontend/src frontend/src
COPY --from=builder /app/frontend/next.config.js frontend/next.config.js
COPY --from=builder /app/frontend/next-env.d.ts frontend/next-env.d.ts
COPY --from=builder /app/frontend/package.json frontend/package.json
COPY --from=builder /app/frontend/tsconfig.json frontend/tsconfig.json

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "frontend"]
