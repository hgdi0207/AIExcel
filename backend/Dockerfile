FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci

COPY backend backend
COPY prisma prisma

RUN npm run prisma:generate --workspace backend
RUN npm run build --workspace backend

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/backend/dist backend/dist
COPY --from=builder /app/backend/scripts backend/scripts
COPY --from=builder /app/backend/nest-cli.json backend/nest-cli.json
COPY --from=builder /app/prisma prisma
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma node_modules/@prisma

RUN mkdir -p backend/storage

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "backend"]
