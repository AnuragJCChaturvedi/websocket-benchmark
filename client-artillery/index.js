const WebSocket = require('ws');
const Schema = require('./protobuf/message_pb'); // Import the generated Protocol Buffers code

// Define the WebSocket server URL
const wsUrl = 'ws://localhost:3001';

// Create a WebSocket client connection
const ws = new WebSocket(wsUrl);

// When the connection is open
ws.on('open', () => {
    console.log('WebSocket connection opened');

    // Create a new message using Protocol Buffers
    const message = new Schema.WebsocketMessage();
    message.setContent('Hello, WebSocket!');
    message.setSenderid('client');
    message.setReceiverid('server');

    // Serialize the message to binary format
    const messageBuffer = message.serializeBinary();

    // Send the serialized message over the WebSocket connection
    ws.send(messageBuffer);
    console.log('Message sent:', message.toObject());
});

// When a message is received from the server
ws.on('message', (data) => {
    try {
        // Deserialize the received binary data
        const receivedMessage = Schema.WebsocketMessage.deserializeBinary(new Uint8Array(data));
        console.log('Message received:');
        console.log(`Content: ${receivedMessage.getContent()}`);
        console.log(`SenderId: ${receivedMessage.getSenderid()}`);
        console.log(`ReceiverId: ${receivedMessage.getReceiverid()}`);
    } catch (error) {
        console.error('Failed to deserialize message:', error);
    }
});

// Handle errors
ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

// Handle connection close
ws.on('close', () => {
    console.log('WebSocket connection closed');
});
