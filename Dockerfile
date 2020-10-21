FROM node:12

WORKDIR /app/mailer
COPY package*.json ./
RUN npm install --registry=https://registry.npm.taobao.org
COPY . .

RUN npm install -g --registry=https://registry.npm.taobao.org pm2

ENV NPM_CONFIG_LOGLEVEL warn

EXPOSE 1512
CMD [ "pm2-runtime", "start", "ecosystem.config.js" ]
