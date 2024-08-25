package main

import (
	"log"
	"net/http"
	"os"
	"time"

	pb "Go/protobuf" // Import your generated Protocol Buffers package

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"google.golang.org/protobuf/proto"
)

// Initialize Prometheus metrics
var (
	counterMessagesReceived = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "websocket_messages_received_total",
		Help: "Total number of messages received",
	})
	counterMessagesSent = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "websocket_messages_sent_total",
		Help: "Total number of messages sent",
	})
	gaugeActiveConnections = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "websocket_active_connections",
		Help: "Number of active WebSocket connections",
	})
	histogramServerResponseTime = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "websocket_server_response_time_seconds",
		Help:    "Histogram of server response times for WebSocket messages",
		Buckets: []float64{0.001, 0.01, 0.05, 0.1, 0.5, 1, 5},
	})
	counterConnectionErrors = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "websocket_connection_errors_total",
		Help: "Total number of connection errors",
	})
	counterMessageErrors = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "websocket_message_errors_total",
		Help: "Total number of message processing errors",
	})
)

func init() {
	// Register metrics with Prometheus
	prometheus.MustRegister(counterMessagesReceived, counterMessagesSent, gaugeActiveConnections,
		histogramServerResponseTime, counterConnectionErrors, counterMessageErrors)
}

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

func websocketHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Failed to upgrade to WebSocket:", err)
		counterConnectionErrors.Inc()
		return
	}
	defer conn.Close()

	log.Println("New WebSocket connection established")
	gaugeActiveConnections.Inc()

	for {
		mt, msg, err := conn.ReadMessage()
		if err != nil {
			log.Println("WebSocket connection closed:", err)
			counterConnectionErrors.Inc()
			break
		}

		log.Println(msg)

		startTime := time.Now()
		counterMessagesReceived.Inc()

		if mt == websocket.BinaryMessage {
			receivedMessage := &pb.WebsocketMessage{}
			if err := proto.Unmarshal(msg, receivedMessage); err != nil {
				log.Println("Failed to unmarshal message:", err)
				counterMessageErrors.Inc()
				continue
			}

			log.Println(receivedMessage.GetContent())
			log.Println(receivedMessage.GetReceiverId())
			log.Println(receivedMessage.GetSenderId())

			// log.Printf("Received message: %s", receivedMessage.String())

			// Echo the message back to the client
			if err := conn.WriteMessage(websocket.BinaryMessage, msg); err != nil {
				log.Println("Error writing message:", err)
				counterMessageErrors.Inc()
			} else {
				counterMessagesSent.Inc()
				histogramServerResponseTime.Observe(time.Since(startTime).Seconds())
			}
		}
	}
	gaugeActiveConnections.Dec()
}

func main() {
	r := mux.NewRouter()

	// WebSocket endpoint
	r.HandleFunc("/ws", websocketHandler)

	// Health check endpoint
	r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello from WebSocket server!"))
	})

	// Prometheus metrics endpoint
	r.Handle("/metrics", promhttp.Handler())

	// Start the server
	log.Fatal(http.ListenAndServe(":"+os.Getenv("GO_SERVER_PORT"), r))
}
