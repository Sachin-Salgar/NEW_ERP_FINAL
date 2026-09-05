# syntax=docker/dockerfile:1.7

FROM node:22.23.2-alpine3.24 AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM alpine:3.24 AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache \
    libcrypto3=3.5.8-r0 \
    libssl3=3.5.8-r0 \
    libstdc++

COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist

USER 1000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const port=process.env.PORT||'3000';const prefix=process.env.API_PREFIX||'/api/v1';fetch('http://127.0.0.1:'+port+prefix+'/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
