# Let's Watch Together

A Chrome extension that allows you to watch YouTube videos synchronously with friends.

## Features

- Create watch parties for YouTube videos
- Synchronize video playback between participants
- Automatic pause/resume when ads appear
- Real-time video seeking synchronization

---

## Backend Requirements (Summary)

The extension requires a WebSocket server to handle real-time communication between participants. The server should:

1. Accept WebSocket connections
2. Handle room creation and joining
3. Broadcast video control events to all participants in a room

You can host the Go-based WebSocket server located in the `/server` directory on your own server and run it to enable real-time communication.

---

## Setup Instructions

### 1. Backend (Go WebSocket Server)

**Prerequisites:**
- Go 1.18+

**Steps:**
1. Clone the repository:
   ```sh
   git clone https://github.com/andclt/letswatch
   cd letswatch/server
   ```
2. Install dependencies:
   ```sh
   go mod tidy
   ```
3. Build and run the server:
   ```sh
   go run main.go
   # or to build a binary:
   go build -o letswatch
   ./letswatch
   ```
4. The server will start on `localhost:8080` by default. You can change the port with the `PORT` environment variable or by editing the code.

**Environment Variables (optional):**
- `PORT`: Set the server port (default: 8080)
- `CHROME_EXTENSION`: Comma-separated list of allowed extension origins for CORS
- `USE_LOCAL`: Set to `true` to use `localhost:8080` as the address

---

### 2. Frontend (Chrome Extension)

**Prerequisites:**
- Google Chrome (v116+ recommended)

**Steps:**
1. Go to `chrome://extensions` in your browser.
2. Enable "Developer mode" (toggle in the top right).
3. Click "Load unpacked" and select the `extension` folder from this repository.
4. The extension should now appear in your Chrome extensions bar.
5. Click the extension icon to open the popup and use the features.

**Notes:**
- The extension is configured to connect to the backend server at `wss://lets-watch-ffrj.onrender.com/ws` by default. To use your own server, update the WebSocket URL in `extension/background.js`.
- You may need to reload the extension after making changes.

---

## Troubleshooting
- Make sure the backend server is running and accessible from the client.
- Check the browser console for errors if the extension is not working as expected.
- Ensure CORS settings allow your extension to connect to the backend.

---

## Contributing
Pull requests and issues are welcome!
