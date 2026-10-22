# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=5000 NPM_CONFIG_CACHE=/tmp/.npm
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src ./src
# An empty managed directory is copied into a new named volume with node ownership.
RUN mkdir -p /app/uploads/profile-photos && chown -R node:node /app/uploads
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/health').then(async r => { if (!r.ok || (await r.json()).status !== 'ok') process.exit(1) }).catch(() => process.exit(1))"]
# Existing production script: node --env-file-if-exists=.env src/server.js
CMD ["npm", "start"]
