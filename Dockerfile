FROM ghcr.io/puppeteer/puppeteer:24.2.0

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY server.js ./

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
