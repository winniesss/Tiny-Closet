# 1️⃣ Build stage — Build the Vite app
FROM node:18 AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 2️⃣ Production stage — Serve static files with Nginx
FROM nginx:1.21.0-alpine

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: custom nginx config (if you have nginx.conf)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
