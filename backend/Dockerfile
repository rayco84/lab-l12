# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY server.ts ./
COPY EventLogger.ts ./
COPY .env ./

# Install TypeScript globally
RUN npm install -g typescript

# Compile TypeScript to JavaScript
RUN tsc

# Expose port 3000
EXPOSE 3000

# Start the server
CMD ["node", "dist/server.js"]
```