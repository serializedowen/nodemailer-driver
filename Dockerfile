FROM node:12
RUN npm install -g --registry=https://registry.npm.taobao.org pm2
WORKDIR /app/mailer
COPY package*.json ./
RUN npm install --registry=https://registry.npm.taobao.org
COPY . .
ENV NPM_CONFIG_LOGLEVEL warn
EXPOSE 32151
CMD [ "pm2-runtime", "start", "ecosystem.config.js" ]
