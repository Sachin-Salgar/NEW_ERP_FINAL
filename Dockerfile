# syntax=docker/dockerfile:1.7

FROM node:22.23.2-alpine3.24 AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22.23.2-alpine3.24 AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const port=process.env.PORT||'3000';const prefix=process.env.API_PREFIX||'/api/v1';fetch('http://127.0.0.1:'+port+prefix+'/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
