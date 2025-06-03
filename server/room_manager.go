package main

import (
	"sync"
)

type RoomManager struct {
	rooms map[string]*Room
	mu    sync.Mutex
}

func newRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
	}
}

func (rm *RoomManager) getOrCreateRoom(id string) *Room {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if room, ok := rm.rooms[id]; ok {
		logger.Debug("RoomManager: Returning existing room", "roomID", id)
		return room
	}

	logger.Info("Creating new room", "roomID", id)
	room := newRoom(id, rm)
	rm.rooms[id] = room
	go room.run()
	return room
}

func (rm *RoomManager) deleteRoom(id string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if room, ok := rm.rooms[id]; ok {
		if len(room.users) == 0 {
			delete(rm.rooms, id)
			logger.Info("RoomManager: Deleted empty room", "roomID", id)
		} else {
			logger.Warn("RoomManager: Attempted to delete non-empty room", "roomID", id, "user_count", len(room.users))
		}
	}
}
