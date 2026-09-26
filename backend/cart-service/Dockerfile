# [FIX VULN-13] production container — WAS: dev mode (nodemon) + NODE_ENV=development.
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

# Compile TypeScript and run the built server in production
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "start"]