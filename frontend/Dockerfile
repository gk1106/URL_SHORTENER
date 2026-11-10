FROM node:20.19.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit
COPY . .
RUN npm test && npm run build

FROM nginxinc/nginx-unprivileged:1.31-alpine
USER root
RUN apk add --no-cache jq
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build --chown=101:101 /app/dist/shortly/browser /usr/share/nginx/html
ENV API_BASE_URL=/api/v1 OIDC_URL=http://localhost:8180 OIDC_REALM=shortener OIDC_CLIENT_ID=shortener-dev
USER 101
EXPOSE 8080
