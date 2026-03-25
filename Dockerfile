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

# Build frontend — keys injected at build time, not stored in image
ARG API_KEY
RUN echo "API_KEY=${API_KEY}" > .env && \
    echo "FIREBASE_API_KEY=AIzaSyAgupOl8e_WUzbJx6e6C58CHtwtcqA_EmM" >> .env && \
    echo "FIREBASE_AUTH_DOMAIN=digital-kids-closet.firebaseapp.com" >> .env && \
    echo "FIREBASE_PROJECT_ID=digital-kids-closet" >> .env && \
    echo "FIREBASE_STORAGE_BUCKET=digital-kids-closet.firebasestorage.app" >> .env && \
    echo "FIREBASE_MESSAGING_SENDER_ID=540232090299" >> .env && \
    echo "FIREBASE_APP_ID=1:540232090299:web:5a3175a901a8b0d85a1f9e" >> .env && \
    npm run build && rm -f .env

# Remove devDeps after build
RUN npm prune --omit=dev

# Fix permissions
RUN chown -R pptruser:pptruser /app

USER pptruser

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
