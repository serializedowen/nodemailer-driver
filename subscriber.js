"use strict";

const config = require("./config");
const amqplib = require("amqplib");
const nodemailer = require("nodemailer");
const retry = require("bluebird-retry");
const logger = require("./logger");

// Setup Nodemailer transport
const transport = nodemailer.createTransport(
  {
    host: config.smtp.host,
    port: config.smtp.port,

    // we intentionally do not set any authentication
    // options here as we are going to use message specific
    // credentials

    auth: {
      user: config.smtp.username,
      pass: config.smtp.password,
    },

    // Security options to disallow using attachments from file or URL
    disableFileAccess: true,
    disableUrlAccess: true,
  },
  {
    // Default options for the message. Used if specific values are not set
    from: "serializedowen@163.com",
  }
);

retry(
  () =>
    amqplib
      .connect(config.amqp)
      .then((connection) => connection.createChannel())
      .tap((channel) => channel.assertQueue(config.queue, { durable: true }))
      .then((channel) => {
        channel.prefetch(1);
        channel.consume(config.queue, (data) => {
          if (data === null) {
            return;
          }

          // Decode message contents
          let message = JSON.parse(data.content.toString());

          // attach message specific authentication options
          // this is needed if you want to send different messages from
          // different user accounts
          //   message.auth = {
          //     user: "testuser",
          //     pass: "testpass",
          //   };

          // console.log(data.fields.redelivered); // Send the message using the previously set up Nodemailer transport

          logger.info("sending email " + JSON.stringify(message));
          transport.sendMail(message, (err, info) => {
            console.log(info, err);
            if (err) {
              logger.error(err + ". Email Data: " + JSON.stringify(message));
              // put the failed message item back to queue
              if (data.fields.redelivered) {
                logger.error("message discarded: " + data);

                return channel.reject(data);
              } else {
                logger.warn("message failed to send, put back to queue");
                return channel.nack(data);
              }
            }

            logger.info(
              "Delivered message %s" + info.messageId,
              +"to:" + info.envelope.to
            );

            // remove message item from the queue
            channel.ack(data);
          });
        });
      })
      .catch((err) => {
        logger.warn(err);
        return Promise.reject(err);
      }),
  { max_tries: 2000000 }
);
