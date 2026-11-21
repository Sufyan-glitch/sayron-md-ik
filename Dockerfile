# Production Dockerfile for SUFYAN-X-IK MD WhatsApp Bot
FROM node:20-bookworm-slim

# Install FFmpeg (required for voice notes, audio processing, sticker conversion, and MP4 remuxing)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      curl \
      ca-certificates \
      git \
      python3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies required for tsx & build)
RUN npm install

# Copy application source code
COPY . .

# Build the frontend production bundle and patch Baileys
RUN npm run build

# Expose default port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start server with 24/7 self-healing supervisor
CMD ["npm", "start"]
