# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:20-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

RUN mkdir -p logs && chown -R nodejs:nodejs logs

USER nodejs

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3002/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "src/server.js"]
