# Step 1: Use the official Golang image as the builder
FROM golang:1.23.0-alpine AS builder

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Copy go.mod and go.sum files
COPY go.mod go.sum ./

# Step 4: Download dependencies
RUN go mod download

# Step 5: Copy the source code into the container
COPY . .

# Step 6: Build the Go application
RUN go build -o websocket-server .

# Step 7: Use a minimal image for the final container
FROM alpine:latest

# Step 8: Set the working directory in the minimal container
WORKDIR /root/

# Step 9: Copy the built Go binary from the builder
COPY --from=builder /app/websocket-server .

# Step 10: Expose the port on which the WebSocket server will run
EXPOSE 3002

# Step 11: Command to run the WebSocket server
CMD ["./websocket-server"]
