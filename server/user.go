package main

import (
	"encoding/json"
	"time"

	"github.com/gorilla/websocket"
)

// middleman between the websocket connection and the room.
type User struct {
	room *Room
	conn *websocket.Conn
	send chan []byte
}

// readPump pumps messages from the websocket connection to the room.
// The application runs readPump in a per-connection go-routine. The
// application ensures that there is at most one reader on a connection
// by executing all reads from this goroutine.
func (u *User) readPump() {
	defer func() {
		u.room.unregister <- u
		u.conn.Close()
		logger.Info("readPump: User disconnected", "user", u.conn.RemoteAddr().String())
	}()

	u.conn.SetReadLimit(maxMessageSize)
	if err := u.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
		logger.Warn("readPump: SetReadDeadline failed", "user", u.conn.RemoteAddr().String(), "error", err)
		return
	}

	u.conn.SetPongHandler(func(string) error {
		if err := u.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
			logger.Warn("readPump: SetReadDeadline in PongHandler failed", "user", u.conn.RemoteAddr().String(), "error", err)
			return err
		}
		return nil
	})

	for {
		var clientMessage ClientMessage
		err := u.conn.ReadJSON(&clientMessage)
		if err != nil {
			switch {
			case websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure):
				logger.Warn("readPump: Unexpected close error", "user", u.conn.RemoteAddr().String(), "error", err)
			case websocket.IsCloseError(err):
				logger.Info("readPump: Graceful client disconnect", "user", u.conn.RemoteAddr().String(), "error", err)
			default:
				logger.Warn("readPump: Errorreading JSON message", "user", u.conn.RemoteAddr().String(), "error", err)
			}

			break
		}

		switch clientMessage.Type {
		case "VIDEO_STATE_CHANGE":
			if u.room == nil {
				logger.Warn("readPump: VIDEO_STATE_CHANGE received without a room", "user", u.conn.RemoteAddr().String())
				continue
			}

			msgBytes, err := json.Marshal(clientMessage)
			if err != nil {
				logger.Error("readPump: Error marshalling VIDEO_STATE_CHANGE", "user", u.conn.RemoteAddr().String(), "error", err)
				continue
			}

			u.room.broadcast <- &BroadcastMessage{data: msgBytes, sender: u}

		case "PING_KEEPALIVE":
			// no op, keep alive from chrome extension

		default:
			logger.Warn("readPump: Unhandled message type", "user", u.conn.RemoteAddr().String(), "type", clientMessage.Type)
		}
	}
}

// writePump pumps messages from the room to the websocket connection.
// A goroutine running writePump is started for each connection. The
// application ensures that there is at most one writer to a per-connection
// by executing all writes from this goroutine
func (u *User) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		u.conn.Close()
	}()

	for {
		select {
		case message, ok := <-u.send:
			if err := u.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				logger.Warn("writePump: SetWriteDeadline failed", "user", u.conn.RemoteAddr().String(), "error", err)
				return
			}

			if !ok {
				u.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			err := u.conn.WriteMessage(websocket.TextMessage, message)
			if err != nil {
				logger.Warn("writePump: WriteMessage failed", "user", u.conn.RemoteAddr().String(), "error", err)
				return
			}

			n := len(u.send)
			for i := 0; i < n; i++ {
				queuedMessage := <-u.send

				if err := u.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
					logger.Warn("writePump: SetWriteDeadline for queued message failed", "user", u.conn.RemoteAddr().String(), "error", err)
					return
				}
				if err := u.conn.WriteMessage(websocket.TextMessage, queuedMessage); err != nil {
					logger.Warn("writePump: WriteMessage for queued message failed", "user", u.conn.RemoteAddr().String(), "error", err)
					return
				}
			}

		case <-ticker.C:
			if err := u.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				logger.Warn("writePump: SetWriteDeadline for ping failed", "user", u.conn.RemoteAddr().String(), "error", err)
				return
			}

			if err := u.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				logger.Warn("writePump: Sending Ping failed", "user", u.conn.RemoteAddr().String(), "error", err)
				return
			}
		}
	}
}
