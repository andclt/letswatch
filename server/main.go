package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 30 * time.Second
	pingPeriod     = (pongWait * 8) / 10
	maxMessageSize = 512
)

var (
	addr              *string
	allowedOriginsSet map[string]bool
	upgrader          = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			logger.Debug("main: WebSocket origin check", "origin", origin)
			return allowedOriginsSet[origin]
		},
	}
	globalRoomManager *RoomManager
	logger            *slog.Logger
)

type ClientMessage struct {
	Type   string `json:"type"`
	RoomID string `json:"roomId"`
	Data   struct {
		CurrentTime float64 `json:"currentTime"`
		IsPaused    bool    `json:"isPaused"`
	} `json:"data"`
}

func init() {
	logger = setupLogger()
	addr = setupAddress()
	allowedOriginsSet = loadAllowedOrigins()
}

func main() {
	globalRoomManager = newRoomManager()

	http.HandleFunc("/ws", handleWebSocket)
	logger.Info("Server starting", "address", *addr)
	if err := http.ListenAndServe(*addr, nil); err != nil {
		logger.Error("Server failed to start", "error", err)
		os.Exit(1)
	}
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Warn("handleWebSocket: Upgrade failed", "error", err)
		return
	}

	if err := conn.SetReadDeadline(time.Now().Add(10 * time.Second)); err != nil {
		logger.Warn("handleWebSocket: SetReadDeadline failed for initial msg", "client", conn.RemoteAddr().String(), "error", err)
		conn.Close()
		return
	}

	var initialMsg ClientMessage
	err = conn.ReadJSON(&initialMsg)
	if err != nil {
		logger.Warn("handleWebSocket: Failed to read initial JSON message", "client", conn.RemoteAddr().String(), "error", err)
		conn.Close()
		return
	}

	if err := conn.SetReadDeadline(time.Time{}); err != nil {
		logger.Warn("handleWebSocket: ClearReadDeadline failed", "client", conn.RemoteAddr().String(), "error", err)
	}

	var targetRoom *Room
	if initialMsg.RoomID == "" {
		logger.Warn("handleWebSocket: Missing roomID in initial msg", "client", conn.RemoteAddr().String(), "error", err)
		conn.Close()
		return
	}

	switch initialMsg.Type {
	case "CREATE_ROOM":
		targetRoom = globalRoomManager.createRoom()
	case "JOIN_ROOM":
		targetRoom = globalRoomManager.getRoom(initialMsg.RoomID)
	default:
		logger.Warn("handleWebSocket: Invalid initial msg type", "client", conn.RemoteAddr().String(), "type", initialMsg.Type)
		conn.Close()
		return
	}

	if targetRoom == nil {
		logger.Error("handleWebSocket: Failed to", "action", initialMsg.Type, "client", conn.RemoteAddr().String(), "roomID", initialMsg.RoomID)
		conn.Close()
		return
	} else {
		logger.Info("handleWebSocket: Client successfully completed", "action", initialMsg.Type, "client", conn.RemoteAddr().String(), "roomID", initialMsg.RoomID)
	}

	client := &User{
		room: targetRoom,
		conn: conn,
		send: make(chan []byte, 256),
	}
	client.room.register <- client

	go client.writePump()
	go client.readPump()
}
