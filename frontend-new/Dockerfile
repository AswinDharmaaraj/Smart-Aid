# frontend-new/Dockerfile
# Multi‑stage Dockerfile for the React (Vite) frontend
# ---------------------------------------------------
# Stage 1 – build the static assets
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (npm ci guarantees lockfile usage)
COPY frontend-new/package*.json ./
RUN npm ci

# Copy source code and build
COPY frontend-new/ .
RUN npm run build   # produces ./dist (or ./build depending on Vite config)

# Stage 2 – serve the static files via nginx
FROM nginx:alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html

# Optional: expose default HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
