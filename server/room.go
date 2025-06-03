package main

type BroadcastMessage struct {
	data   []byte
	sender *User
}

type Room struct {
	id    string
	users map[*User]bool

	broadcast  chan *BroadcastMessage
	register   chan *User
	unregister chan *User

	manager *RoomManager
}

func newRoom(id string, manager *RoomManager) *Room {
	return &Room{
		id:         id,
		users:      make(map[*User]bool),
		broadcast:  make(chan *BroadcastMessage),
		register:   make(chan *User),
		unregister: make(chan *User),
		manager:    manager,
	}
}

func (r *Room) run() {
	logger.Debug("Room: Starting run loop", "roomID", r.id)

	defer func() {
		logger.Debug("Room: Stopping run loop", "roomID", r.id)

		for user := range r.users {
			close(user.send)
		}
	}()

	for {
		select {
		case user := <-r.register:
			r.users[user] = true
			logger.Info("Room: User registered", "roomID", r.id, "user", user.conn.RemoteAddr().String(), "total_users", len(r.users))

		case user := <-r.unregister:
			if _, ok := r.users[user]; ok {
				delete(r.users, user)
				close(user.send)
				logger.Info("Room: User unregistered", "roomID", r.id, "user", user.conn.RemoteAddr().String(), "total_users", len(r.users))
				if len(r.users) == 0 {
					logger.Info("Room: Room is empty, deleting", "roomID", r.id)
					r.manager.deleteRoom(r.id)
					return
				}
			}
		case message := <-r.broadcast:
			for user := range r.users {
				if user != message.sender {
					select {
					case user.send <- message.data:
					default:
						logger.Warn("Room: Send channel full, unregistering user", "roomID", r.id, "user", user.conn.RemoteAddr().String())
						delete(r.users, user)
						close(user.send)
					}
				}
			}
		}
	}
}
