const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const client = require("prom-client");

const messages = require("./protobuf/message_pb"); // Importing the Protocol Buffers definition

// Create a new Prometheus registry to hold all custom metrics
const registry = new client.Registry();

// Collect default metrics (e.g., CPU, memory) and register them in the custom registry
client.collectDefaultMetrics({ register: registry });

// Define custom Prometheus metrics for tracking various aspects of WebSocket performance
const counterMessagesReceived = new client.Counter({
  name: 'websocket_messages_received_total',
  help: 'Total number of messages received',
});

const counterMessagesSent = new client.Counter({
  name: 'websocket_messages_sent_total',
  help: 'Total number of messages sent',
});

const gaugeActiveConnections = new client.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections',
});

const histogramServerResponseTime = new client.Histogram({
  name: 'websocket_server_response_time_seconds',
  help: 'Histogram of server response times for WebSocket messages',
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 5], // Buckets for measuring time in seconds
});

const counterConnectionErrors = new client.Counter({
  name: 'websocket_connection_errors_total',
  help: 'Total number of connection errors',
});

const counterMessageErrors = new client.Counter({
  name: 'websocket_message_errors_total',
  help: 'Total number of message processing errors',
});

// Register custom metrics to the Prometheus registry
registry.registerMetric(counterMessagesReceived);
registry.registerMetric(counterMessagesSent);
registry.registerMetric(gaugeActiveConnections);
registry.registerMetric(histogramServerResponseTime);
registry.registerMetric(counterConnectionErrors);
registry.registerMetric(counterMessageErrors);

// Create an Express application
const app = express();

// Define a simple route to check server availability
app.get("/", (req, res) => {
  res.send("Hello from WebSocket server!");
});

// Expose the Prometheus metrics at the /metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

// Create an HTTP server and attach the Express app to it
const server = http.createServer(app);

// Initialize a WebSocket server and bind it to the HTTP server
const wss = new WebSocket.Server({ server });

// Handle new WebSocket connections
wss.on('connection', (ws) => {
  gaugeActiveConnections.inc(); // Increment active connections gauge
  console.log("New connection established successfully!");

  // Handle incoming WebSocket messages
  ws.on('message', (msg) => {
    const startTime = Date.now(); // Record the start time for response time measurement
    counterMessagesReceived.inc(); // Increment the received messages counter

    if (typeof msg === 'string') {
      // Handle text messages (e.g., for debugging purposes)
      console.log('String message received:', msg);
    } else if (Buffer.isBuffer(msg)) {
      try {
        console.log(msg)
        // Deserialize the received binary message to a WebsocketMessage instance
        const receivedMessage = messages.WebsocketMessage.deserializeBinary(msg);
        console.log('Message received:', receivedMessage);
        console.log(`Content: ${receivedMessage.getContent()}`);
        console.log(`SenderId: ${receivedMessage.getSenderid()}`);
        console.log(`ReceiverId: ${receivedMessage.getReceiverid()}`);

        // Echo the received message back to the client
        ws.send(msg);
        counterMessagesSent.inc(); // Increment the sent messages counter

        // Measure the time taken to process the message and generate a response
        const responseTime = (Date.now() - startTime) / 1000;
        histogramServerResponseTime.observe(responseTime);
      } catch (err) {
        // Increment the message processing errors counter and log the error
        counterMessageErrors.inc();
        console.error('Failed to deserialize message:', err);
      }
    } else {
      // Handle other message types if necessary
      console.log('Message received (non-binary):', msg);
    }
  });

  // Send an initial message to the client to confirm connection
  const initialMessage = new messages.WebsocketMessage();
  initialMessage.setContent("Connection established successfully!");
  initialMessage.setSenderid("server");
  initialMessage.setReceiverid("client");

  // Serialize the initial message to binary format and send it
  const binaryInitialMessage = initialMessage.serializeBinary();
  ws.send(binaryInitialMessage);

  // Handle WebSocket connection closure
  ws.on('close', () => {
    gaugeActiveConnections.dec(); // Decrement active connections gauge
    console.log("Connection closed");
  });

  // Handle WebSocket errors
  ws.on('error', (err) => {
    counterConnectionErrors.inc(); // Increment the connection errors counter
    console.error("WebSocket error:", err);
  });
});

// Start the HTTP and WebSocket server on port 3001
server.listen(process.env.NODEJS_SERVER_PORT, () => {
  console.log(`HTTP and WebSocket servers are active on port ${process.env.NODEJS_SERVER_PORT}`);
});
