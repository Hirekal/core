FROM node:24-alpine AS builder

WORKDIR /app

ENV HUSKY=0

COPY package.json package-lock.json ./
COPY apps/api-app/package.json ./apps/api-app/
COPY apps/console-app/package.json ./apps/console-app/

RUN npm ci --ignore-scripts

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY apps/api-app ./apps/api-app

ARG GITHUB_REPOSITORY
ARG GITHUB_SHA

RUN npm run build:api

FROM node:24-alpine AS production

WORKDIR /app

ENV HUSKY=0
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api-app/package.json ./apps/api-app/
COPY apps/console-app/package.json ./apps/console-app/

RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/apps/api-app/main.js"]
