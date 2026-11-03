FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY apps ./apps
COPY scripts ./scripts

CMD ["npm", "run", "start:api"]
