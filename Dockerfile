FROM node:20-alpine

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build assets
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
