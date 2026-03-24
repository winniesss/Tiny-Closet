FROM ghcr.io/puppeteer/puppeteer:24.2.0

USER root

# Install build tools
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install ALL deps (need devDeps for build)
COPY package.json ./
RUN npm install

# Copy source files
COPY . ./

# Build frontend
RUN echo "API_KEY=AIzaSyCOQxEQYEyuv5H4-ToryhvSdBSLsApTSpI" > .env && npm run build && rm -f .env

# Remove devDeps after build
RUN npm prune --omit=dev

# Fix permissions
RUN chown -R pptruser:pptruser /app

USER pptruser

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
