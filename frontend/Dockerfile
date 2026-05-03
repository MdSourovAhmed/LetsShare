
# ─── Production image ─────────────────────────────────────────────────────────
# Stage 1: build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# VITE_BACKEND_URL can be passed at build time:
#   docker build --build-arg VITE_BACKEND_URL=http://192.168.1.10:3000 .
ARG VITE_BACKEND_URL=""
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

# ─── Stage 2: serve with nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx site
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
