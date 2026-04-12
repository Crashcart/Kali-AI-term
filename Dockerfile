FROM node:20-alpine

# Install dumb-init and curl for proper signal handling and health checks
RUN apk add --no-cache dumb-init curl

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server.js ./
COPY db ./db
COPY lib ./lib
COPY plugins ./plugins
COPY public ./public

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
