FROM node:18-alpine

# Install curl for health check and ca-certificates for HTTPS requests to FHIR endpoints
RUN apk add --no-cache curl ca-certificates

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --no-audit --no-fund

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S diseaseZone -u 1001

# Change ownership of the app directory
RUN chown -R diseaseZone:nodejs /app
USER diseaseZone

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["npm", "start"]