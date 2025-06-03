# Let's Watch Together

A Chrome extension that allows you to watch YouTube videos synchronously with friends.

## Features

- Create watch parties for YouTube videos
- Synchronize video playback between participants
- Automatic pause/resume when ads appear
- Real-time video seeking synchronization

## Backend Requirements

The extension requires a WebSocket server to handle real-time communication between participants. The server should:

1. Accept WebSocket connections
2. Handle room creation and joining
3. Broadcast video control events to all participants in a room

You can host the Go-based WebSocket server located in the /server directory on your own server and run it to enable real-time communication.
