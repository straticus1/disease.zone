FROM node:18-slim

# Install system dependencies for ML/AI libraries and FHIR endpoints
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --no-audit --no-fund

# Copy application code
COPY . .

# Make security scripts executable
RUN chmod +x scripts/security-crisis-recovery.sh scripts/production-security-check.sh

# Create non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs diseaseZone

# Create logs directory and set permissions
RUN mkdir -p /app/logs && chown -R diseaseZone:nodejs /app/logs

# Change ownership of the app directory
RUN chown -R diseaseZone:nodejs /app
USER diseaseZone

# Expose port
EXPOSE 3000

# Enhanced health check with security validation
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health && \
      curl -f http://localhost:3000/security/status || exit 1

# Start the application
CMD ["npm", "start"]