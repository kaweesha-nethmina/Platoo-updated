# Use official Node.js image
FROM node:20

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy entire project
COPY . .

# Expose cart-service port
EXPOSE 3005

# Set environment to development
ENV NODE_ENV=development

# Run the app using nodemon
CMD ["npm", "run", "dev"]
