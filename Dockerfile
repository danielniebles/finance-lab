FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci

EXPOSE 3000

# Sync any new packages, generate client, run migrations, then start dev server
CMD ["sh", "-c", "npm install && npx prisma generate && npx prisma migrate deploy && npm run dev"]
