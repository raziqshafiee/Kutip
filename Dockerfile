# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Prisma's query engine needs openssl on Alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# Only reads prisma/schema.prisma to generate the client -- no DB connection
# needed at build time.
RUN npx prisma generate

# None of Kutip's routes statically prerender data from the database (every
# dashboard/API page reads Clerk's auth() first, which forces dynamic
# rendering), so `next build` does not need a live DATABASE_URL.
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
