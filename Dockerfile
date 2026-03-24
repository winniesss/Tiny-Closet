FROM ghcr.io/puppeteer/puppeteer:24.2.0

USER root

WORKDIR /app

COPY package.json ./

RUN npm install --omit=dev

COPY server.js ./

RUN chown -R pptruser:pptruser /app

USER pptruser

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
