# Backend Nevú - Railway Deployment
FROM node:18-alpine AS base

# Install build tools for native modules (e.g., sqlite3, pg)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Only copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
# Use npm ci if lockfile exists for deterministic installs
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy the rest of the backend source
COPY . .

ENV NODE_ENV=production

# Railway injects PORT env var
EXPOSE 5000

# Start the server
CMD ["npm", "start"]
