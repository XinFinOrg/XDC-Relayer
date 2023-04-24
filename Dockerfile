FROM node:18-alpine

RUN mkdir -p /home/node/app

WORKDIR /home/node/app
COPY src/ src/
COPY patches patches/
COPY tsconfig.json ./
COPY package*.json ./

RUN npm install
RUN npm run build

EXPOSE 3000

CMD [ "npm", "run", "start" ]