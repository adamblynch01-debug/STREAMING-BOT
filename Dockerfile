FROM node:22-slim

# Install FFmpeg and build tools for native modules
RUN apt-get update && \
    apt-get install -y ffmpeg python3 build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Verify FFmpeg is installed
RUN ffmpeg -version

EXPOSE 3000

CMD ["node", "index.js"]
