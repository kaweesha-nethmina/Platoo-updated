# Use official Node.js image
FROM node:20

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install all dependencies (including devDependencies, since nodemon and ts-node are usually dev deps)
RUN npm install

# Copy all source code
COPY . .

# Expose the service port (assuming 4001; adjust if different)
EXPOSE 3008

# Set environment to development
ENV NODE_ENV=development

# Command to start in dev mode with nodemon + ts-node
CMD ["npm", "run", "dev"]
