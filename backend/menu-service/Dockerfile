# [FIX VULN-13] production container — WAS: dev mode (nodemon) + NODE_ENV=development.
FROM node:20

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the whole project
COPY . .

# Expose the port (3001)
EXPOSE 3001

# Compile TypeScript and run the built server in production
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "start"]