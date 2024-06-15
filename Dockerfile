# Use Node.js base image
FROM node:18-alpine

# Install build dependencies
RUN apk add --no-cache python3 py3-pip build-base

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port (change according to your app)
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]