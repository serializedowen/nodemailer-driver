"use strict";

const amqplib = require("amqplib");
const config = require("./config");
var bodyParser = require("body-parser");
const express = require("express");
const { isEmail } = require("@serializedowen/regex.js");
const jsonParser = bodyParser.json();
const retry = require("bluebird-retry");
const app = express();

const { EventEmitter } = require("events");

const eventEmitter = new EventEmitter();

const logger = require("debug")("publisher");

// app.use(jsonParser);
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/send", jsonParser, (req, res, next) => {
  const { text, subject, to } = req.body;

  if (!text || !subject || !to) return res.status(400).send();

  if (!isEmail(to)) return res.status(400).send("bad email address");
  eventEmitter.emit("sendemail", { text, subject, to });
  res.status(200).send("ack");
  next();
});

app.listen(config.publisher.port, () =>
  console.log(`Example app listening on port ${config.publisher.port}!`)
);

retry(
  () =>
    amqplib
      .connect(config.amqp)
      .then((connection) => connection.createChannel())
      .tap((channel) =>
        channel.assertQueue(config.queue, {
          durable: true,
        })
      )
      .then((channel) => {
        let sender = (content, next) => {
          let sent = channel.sendToQueue(
            config.queue,
            Buffer.from(JSON.stringify(content)),
            {
              // Store queued elements on disk
              persistent: true,
              contentType: "application/json",
            }
          );
          if (sent) {
            return next();
          } else {
            channel.once("drain", () => next());
          }
        };

        eventEmitter.on("sendemail", (message) => {
          sender(message, () => logger(message.toString() + "sent to queue!"));
        });
      }),
  { max_tries: 200000 }
);
