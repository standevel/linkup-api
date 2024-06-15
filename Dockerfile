# Base image
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY .  .

RUN npm run build

EXPOSE 4000

ENTRYPOINT  [ "node", "dist/main.js" ]
