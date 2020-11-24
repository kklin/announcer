FROM node:14 as build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --silent
COPY . ./
RUN npm run build

FROM nginx
COPY --from=build /usr/src/app/build /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
