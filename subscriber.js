"use strict";

const config = require("./config");
const amqplib = require("amqplib");
const nodemailer = require("nodemailer");
const retry = require("bluebird-retry");
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

// const connector = (err, connection) => {
//   if (err) {
//     console.error(err.stack);
//     setTimeout(() => {
//       amqplib.connect(config.amqp, connector);
//     }, 5000);

//     return;
//   }
//   // Create channel
//   connection.createChannel((err, channel) => {
//     if (err) {
//       console.error(err.stack);
//       return process.exit(1);
//     }

//     // Ensure queue for messages
//     channel.assertQueue(
//       config.queue,
//       {
//         // Ensure that the queue is not deleted when server restarts
//         durable: true,
//       },
//       (err) => {
//         if (err) {
//           console.error(err.stack);
//           return process.exit(1);
//         }

//         // Only request 1 unacked message from queue
//         // This value indicates how many messages we want to process in parallel
//         channel.prefetch(1);

//         // Set up callback to handle messages received from the queue
//         channel.consume(config.queue, (data) => {});
//       }
//     );
//   });
// };

// // Create connection to AMQP server
// amqplib.connect(config.amqp, connector);
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

          console.log(data.fields.redelivered); // Send the message using the previously set up Nodemailer transport
          transport.sendMail(message, (err, info) => {
            if (err) {
              console.error(err.stack);
              // put the failed message item back to queue
              if (data.fields.redelivered) return channel.reject(data);
              else return channel.nack(data);
            }
            console.log("Delivered message %s", info.messageId);
            // remove message item from the queue
            channel.ack(data);
          });
        });
      })
      .catch((err) => {
        console.warn(err);
        return Promise.reject(err);
      }),
  { max_tries: 2000000 }
);
