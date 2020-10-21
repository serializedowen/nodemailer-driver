# Dockerized Nodemailer AMQP example

This is an example of using RabbitMQ ([amqplib](http://www.squaremobius.net/amqp.node/)) for queueing [Nodemailer](https://nodemailer.com/) email messages. This allows you to push messages from your application quickly to delivery queue and let Nodemailer handle the actual sending asynchronously from a background process.

This example also demonstrates using different credentials for different messages using the same Nodemailer transport.

## Setup

this example assumes you have docker-engine and docker-compose installed

1. modify config.json file to use your credentials
2. `docker-compose up` and you are all set.
