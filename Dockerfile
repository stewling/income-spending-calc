FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5025 \
    DATA_DIR=/app/data

COPY package.json server.js seed-data.js ./
COPY public ./public

RUN mkdir -p /app/data

VOLUME ["/app/data"]

EXPOSE 5025

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5025) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
