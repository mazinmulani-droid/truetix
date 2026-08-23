FROM node:20-alpine

# Install OpenSSL and libc dependencies required by Prisma engine on Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy package configuration and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client & Build TypeScript
RUN npx prisma generate
RUN npm run build

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push && npx prisma db seed && node dist/src/main"]
