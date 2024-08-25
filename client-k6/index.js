import { check, sleep } from 'k6';
import ws from 'k6/ws';
import protobuf from 'https://cdn.jsdelivr.net/npm/protobufjs@7.2.0/dist/protobuf.min.js';

const MAX_MESSAGE_COUNT = 20

// Define the root namespace and schema
const root = protobuf.Root.fromJSON({
    nested: {
        messagepackage: {
            nested: {
                WebsocketMessage: {
                    fields: {
                        content: { type: "string", id: 1 },
                        senderId: { type: "string", id: 2 },
                        receiverId: { type: "string", id: 3 }
                    }
                }
            }
        }
    }
});

// Access the WebsocketMessage type
const WebsocketMessage = root.lookupType("messagepackage.WebsocketMessage");

export let options = {
    scenarios: {
        // Scenario 1: Nodejs server
        nodejs: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '1m', target: 100 }, // Ramp-up to 50 VUs in 1 minute
                { duration: '3m', target: 500 }, // Hold at 50 VUs for 2 minutes
                { duration: '7m', target: 1000 }, // Ramp-down to 0 VUs in 1 minute
            ],
            exec: "generateLoadNodejs",
        },

        // Scenario 2: Golang server
        golang: {
            executor: 'ramping-vus',
            startVUs: 1,
            stages: [
                { duration: '1m', target: 100 }, // Ramp-up to 50 VUs in 1 minute
                { duration: '3m', target: 500 }, // Hold at 50 VUs for 2 minutes
                { duration: '7m', target: 1000 }, // Ramp-down to 0 VUs in 1 minute
            ],
            exec: "generateLoadGolang",
        }
    },
};

// Function to generate a random number of messages to send
function getRandomMessageCount(max) {
    return Math.floor(Math.random() * max) + 1;
}

function getWebsocketURL(containerName, port) {
    return `ws://${containerName}:${port}/ws`
}

// Function to handle WebSocket communication
function communicateWebSocket(socket, messageBuffer, messageCount) {
    socket.on('open', function open() {
        console.log('WebSocket connection opened');

        for (let i = 0; i < messageCount; i++) {
            const trimmedBuffer = messageBuffer.buffer.slice(0, messageBuffer.byteLength);
            socket.sendBinary(trimmedBuffer); // Send Protocol Buffer message
            console.log(`Sent message ${i + 1}`);
            sleep(1); // Shorter delay for high-load scenarios
        }

        socket.close(); // Close the socket after sending all messages
    });

    socket.on('error', function (e) {
        console.log("Error: err", e.error())
    });

    socket.on('message', function (msg) {
        console.log(`Received message: ${msg}`)
        check(msg, { 'message is valid': (m) => m !== '' });
    });

    socket.on('close', () => console.log('WebSocket connection closed'));
}

function generateLoad(url) {

    // Create a new message using Protocol Buffers
    const payload = {
        content: 'Hello from K6!',
        senderId: 'client',
        receiverId: 'server'
    };

    // Optionally verify the payload
    const errMsg = WebsocketMessage.verify(payload);
    if (errMsg) throw new Error(errMsg);

    // Create and serialize the message
    const message = WebsocketMessage.create(payload);
    const messageBuffer = WebsocketMessage.encode(message).finish();

    // Log the encoded message
    console.log("Encoded Buffer: ", messageBuffer.toString('hex'));
    console.log(messageBuffer)

    // Decode the binary data back into a message (optional, for debugging)
    const decodedMessage = WebsocketMessage.decode(messageBuffer);
    console.log("Decoded Message: ", JSON.stringify(decodedMessage));

    const messageCount = getRandomMessageCount(MAX_MESSAGE_COUNT);

    const res = ws.connect(url, (socket) => {
        communicateWebSocket(socket, messageBuffer, messageCount);
    });

    check(res, { 'status is 101': (r) => r && r.status === 101 });
    // sleep(1); // Sleep between iterations
}

export function generateLoadNodejs() {
    // Get the Node.js WebSocket URL from the environment variable
    const nodejsPort = __ENV.NODEJS_SERVER_PORT || 3001;
    generateLoad(getWebsocketURL("nodejs-server", nodejsPort));
}

export function generateLoadGolang() {
    // Get the Go WebSocket URL from the environment variable
    const golangPort = __ENV.GO_SERVER_PORT || 3002;
    generateLoad(getWebsocketURL("go-server", golangPort));
}