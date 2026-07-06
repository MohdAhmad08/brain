FROM node:20-alpine

WORKDIR /app

# Copy package dependencies and install
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY frontend/ .

# Build Next.js project
RUN npm run build

# Expose Next.js server port
EXPOSE 3000

CMD ["npm", "run", "start"]
