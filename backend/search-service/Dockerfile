# Use official Node.js image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the whole project
COPY . .

# Expose the port (3001)
EXPOSE 3002

# Set environment to development
ENV NODE_ENV=development

# Run the app in development mode using nodemon
CMD ["npm", "run", "dev"]
