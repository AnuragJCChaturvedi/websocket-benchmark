const Schema = require('./protobuf/message_pb');

function sendMessage(userContext, events, done) {
    try {
        const payload = {
            content: 'Hello, WebSocket!',
            senderId: 'client',
            receiverId: 'server'
        };

        const newMessage = new Schema.WebsocketMessage();
        newMessage.setContent(payload.content);
        newMessage.setSenderid(payload.senderId);
        newMessage.setReceiverid(payload.receiverId);

        const messageBuffer = newMessage.serializeBinary();

        const bufferMessage = Buffer.from(messageBuffer);

        console.log(bufferMessage)
        
        // Store the binary message in the user context to send it in the scenario
        userContext.vars.message = bufferMessage;
    } catch (error) {
        console.error('Error in sendMessage:', error);
    }
    done();
}

module.exports = {
  sendMessage,
};
