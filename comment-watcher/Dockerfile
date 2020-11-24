FROM node:14
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --silent
COPY . ./
CMD ["npm", "run", "start-prod"]
