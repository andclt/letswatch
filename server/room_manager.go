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

func (rm *RoomManager) getRoom(id string) *Room {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if room, ok := rm.rooms[id]; ok {
		logger.Debug("RoomManager: Returning existing room", "roomID", id)
		return room
	}

	return nil
}

func (rm *RoomManager) createRoom() *Room {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	id, err := generateRandomID()
	if err != nil {
		logger.Error("RoomManager: Failed to generate random ID room")
		return nil
	}

	logger.Info("RoomManager: Creating new room", "roomID", id)
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
