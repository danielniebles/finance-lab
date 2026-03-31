FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci

EXPOSE 3000

# Generate client for this platform, run migrations, then start dev server
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm run dev"]
