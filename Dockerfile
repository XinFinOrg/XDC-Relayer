FROM --platform=linux/amd64 node:18-alpine

RUN mkdir -p /home/node/app

WORKDIR /home/node/app
COPY src/ src/
COPY patches patches/
COPY tsconfig.json ./
COPY package*.json ./

RUN npm install
RUN npm run build

RUN apk --update add redis
RUN npm install -g concurrently

EXPOSE 3000

CMD concurrently "/usr/bin/redis-server --bind '0.0.0.0'" "sleep 5s; npm run start"