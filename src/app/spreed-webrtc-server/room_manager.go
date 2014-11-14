/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed WebRTC.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

package main

import (
	"log"
	"sync"
)

type RoomStatusManager interface {
	RoomUsers(*Session) []*DataSession
	JoinRoom(string, *DataRoomCredentials, *Session, Sender) (*DataRoom, error)
	LeaveRoom(*Session)
	UpdateRoom(*Session, *DataRoom) (*DataRoom, error)
}

type Broadcaster interface {
	Broadcast(*Session, interface{})
}

type RoomStats interface {
	RoomInfo(includeSessions bool) (count int, sessionInfo map[string][]string)
}

type RoomManager interface {
	RoomStatusManager
	Broadcaster
	RoomStats
}

type roomManager struct {
	sync.RWMutex
	OutgoingEncoder
	defaultRoomEnabled bool
	globalRoomID       string
	roomTable          map[string]RoomWorker
}

func NewRoomManager(config *Config, encoder OutgoingEncoder) RoomManager {
	return &roomManager{
		sync.RWMutex{},
		encoder,
		config.DefaultRoomEnabled,
		config.globalRoomid,
		make(map[string]RoomWorker),
	}
}

func (rooms *roomManager) RoomUsers(session *Session) []*DataSession {
	if room, ok := rooms.Get(session.Roomid); ok {
		return room.GetUsers()
	}
	// TODO(lcooper): This should return an error.
	return []*DataSession{}
}

func (rooms *roomManager) JoinRoom(id string, credentials *DataRoomCredentials, session *Session, sender Sender) (*DataRoom, error) {
	if id == "" && !rooms.defaultRoomEnabled {
		return nil, &DataError{Type: "Error", Code: "default_room_disabled", Message: "The default room is not enabled"}
	}

	return rooms.GetOrCreate(id, credentials).Join(credentials, session, sender)
}

func (rooms *roomManager) LeaveRoom(session *Session) {
	if room, ok := rooms.Get(session.Roomid); ok {
		room.Leave(session)
	}
}

func (rooms *roomManager) UpdateRoom(session *Session, room *DataRoom) (*DataRoom, error) {
	if !session.Hello || session.Roomid != room.Name {
		return nil, &DataError{Type: "Error", Code: "not_in_room", Message: "Cannot update other rooms"}
	}
	// XXX(lcooper): We'll process and send documents without this field
	// correctly, however clients cannot not handle it currently.
	room.Type = "Room"
	if roomWorker, ok := rooms.Get(session.Roomid); ok {
		return room, roomWorker.Update(room)
	}
	// TODO(lcooper): We should almost certainly return an error in this case.
	return room, nil
}

func (rooms *roomManager) Broadcast(session *Session, m interface{}) {
	outgoing := &DataOutgoing{
		From: session.Id,
		A:    session.Attestation(),
		Data: m,
	}

	message, err := rooms.EncodeOutgoing(outgoing)
	if err != nil {
		return
	}

	id := session.Roomid
	if id != "" && id == rooms.globalRoomID {
		rooms.RLock()
		for _, room := range rooms.roomTable {
			room.Broadcast(session, message)
		}
		rooms.RUnlock()
	} else if room, ok := rooms.Get(id); ok {
		room.Broadcast(session, message)
	} else {
		log.Printf("No room named %s found for broadcast message %#v", id, m)
	}
	message.Decref()
}

func (rooms *roomManager) RoomInfo(includeSessions bool) (count int, sessionInfo map[string][]string) {
	rooms.RLock()
	defer rooms.RUnlock()

	count = len(rooms.roomTable)
	if includeSessions {
		sessionInfo := make(map[string][]string)
		for roomid, room := range rooms.roomTable {
			sessionInfo[roomid] = room.SessionIDs()
		}
	}
	return
}

func (rooms *roomManager) Get(id string) (room RoomWorker, ok bool) {
	rooms.RLock()
	room, ok = rooms.roomTable[id]
	rooms.RUnlock()
	return
}

func (rooms *roomManager) GetOrCreate(id string, credentials *DataRoomCredentials) RoomWorker {
	room, ok := rooms.Get(id)
	if !ok {
		rooms.Lock()
		// Need to re-check, another thread might have created the room
		// while we waited for the lock.
		room, ok = rooms.roomTable[id]
		if !ok {
			room = NewRoomWorker(rooms, id, credentials)
			rooms.roomTable[id] = room
			rooms.Unlock()
			go func() {
				// Start room, this blocks until room expired.
				room.Start()
				// Cleanup room when we are done.
				rooms.Lock()
				defer rooms.Unlock()
				delete(rooms.roomTable, id)
				log.Printf("Cleaned up room '%s'\n", id)
			}()
		} else {
			rooms.Unlock()
		}
	}

	return room
}

func (rooms *roomManager) GlobalUsers() []*roomUser {
	if rooms.globalRoomID == "" {
		return make([]*roomUser, 0)
	}
	rooms.RLock()
	if room, ok := rooms.roomTable[rooms.globalRoomID]; ok {
		rooms.RUnlock()
		return room.Users()
	}

	rooms.RUnlock()
	return make([]*roomUser, 0)
}
