FROM node:22-alpine AS builder

WORKDIR /app

ARG BACKEND_ORIGIN=http://backend:3000
ENV BACKEND_ORIGIN=${BACKEND_ORIGIN}

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci

COPY frontend frontend

RUN npm run build --workspace frontend

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV BACKEND_ORIGIN=http://backend:3000

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/frontend/.next frontend/.next
COPY --from=builder /app/frontend/public frontend/public
COPY --from=builder /app/frontend/src frontend/src
COPY --from=builder /app/frontend/next.config.js frontend/next.config.js
COPY --from=builder /app/frontend/next-env.d.ts frontend/next-env.d.ts
COPY --from=builder /app/frontend/package.json frontend/package.json
COPY --from=builder /app/frontend/tsconfig.json frontend/tsconfig.json

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "frontend"]
