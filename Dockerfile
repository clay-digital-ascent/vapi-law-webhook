FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Use npm ci for reproducible builds
RUN npm ci --only=production

# Copy application source
COPY src/ ./src/

# Expose the correct webhook port
EXPOSE 3020

# Set production environment
ENV NODE_ENV=production

CMD ["npm", "start"]
