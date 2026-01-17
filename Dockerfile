FROM node:24-alpine AS builder

# Install Chrome dependencies
RUN apk add --no-cache \
    nss \
    freetype \
    freetype-dev \
    openssl \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    postgresql-client


WORKDIR /usr/src/app


COPY package.json ./
COPY package-lock.json ./

RUN npm ci

COPY . .

RUN npx svelte-kit sync
RUN npx prisma generate


RUN npm run build

FROM node:24-alpine

# Install Chrome dependencies in the runtime image
RUN apk add --no-cache \
    nss \
    freetype \
    freetype-dev \
    openssl \
    harfbuzz \
    ca-certificates \
    ttf-freefont

WORKDIR /usr/src/app

COPY package.json ./
COPY package-lock.json ./

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /usr/src/app/build ./build

COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/prod-server.js ./prod-server.js

EXPOSE 3000

ENV NODE_ENV=production
ENV HOST=0.0.0.0 
ENV PORT=3000   

CMD ["sh", "-c", "npx prisma migrate deploy && node prod-server.js"]