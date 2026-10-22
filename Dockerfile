# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
# Public build-time setting, never a secret. Relative /api uses the Nginx proxy.
ARG VITE_API_URL=/api
RUN VITE_API_URL="${VITE_API_URL}" npm run build

FROM nginx:stable-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html/interntrack
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/interntrack/index.html"]
# Skip root-oriented entrypoint configuration; the complete config is immutable.
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
