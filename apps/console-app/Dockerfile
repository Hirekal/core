FROM node:24-alpine AS builder

WORKDIR /app

ENV HUSKY=0

COPY package.json package-lock.json ./
COPY apps/api-app/package.json ./apps/api-app/
COPY apps/console-app/package.json ./apps/console-app/

RUN npm ci --ignore-scripts

COPY apps/console-app ./apps/console-app

ARG GITHUB_REPOSITORY
ARG GITHUB_SHA

RUN npm run build:console

FROM nginx:1.27-alpine AS production

COPY apps/console-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/console-app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
