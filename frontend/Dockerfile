FROM node:20-alpine3.22

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 7777 

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
