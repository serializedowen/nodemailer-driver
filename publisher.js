"use strict";

const amqplib = require("amqplib/callback_api");
const config = require("./config");

const express = require("express");

const app = express();

app.get("/", (req, res) => res.send("Hello World!"));

app.listen(config.publisher.port, () =>
  console.log(`Example app listening on port ${config.publisher.port}!`)
);

const connector = (err, connection) => {
  if (err) {
    console.error(err.stack);

    setTimeout(() => {
      amqplib.connect(config.amqp, connector);
    }, 5000);

    return;
  }

  // Create channel
  const channelCreate = (err, channel) => {
    if (err) {
      console.error(err.stack);

      setTimeout(() => {
        connection.createChannel(channelCreate);
      }, 5000);
      return;
    }

    // Ensure queue for messages
    channel.assertQueue(
      config.queue,
      {
        // Ensure that the queue is not deleted when server restarts
        durable: true,
      },
      (err) => {
        if (err) {
          console.error(err.stack);
          return process.exit(1);
        }

        // Create a function to send objects to the queue
        // Javascript object is converted to JSON and then into a Buffer
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

        // push 100 messages to queue
        let sent = 0;
        let sendNext = () => {
          if (sent >= 20) {
            console.log("All messages sent!");
            // Close connection to AMQP server
            // We need to call channel.close first, otherwise pending
            // messages are not written to the queue
            return channel.close(() => connection.close());
          }
          sent++;
          sender(
            {
              to: "serializedowen@163.com",
              subject: "Test message #" + sent,
              text: "hello world!",
            },
            sendNext
          );
        };

        sendNext();
      }
    );
  };

  connection.createChannel(channelCreate);
};

// Create connection to AMQP server
amqplib.connect(config.amqp, connector);
