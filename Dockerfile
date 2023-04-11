FROM node:12.16.1-alpine
LABEL version="1.0"
LABEL description="Messages Microservice"

RUN apk add libpq

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Bundle app source
COPY . /usr/src/app

# Install app dependencies
RUN npm install

EXPOSE 3000

CMD ["npm", "start"]
