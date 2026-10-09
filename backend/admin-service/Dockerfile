# Use an official Node.js runtime
FROM node:20

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port your app uses
EXPOSE 4000

# Set environment
ENV NODE_ENV=production

# Start the app in development mode
CMD ["npm", "run", "dev"]
