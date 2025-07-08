let ws = null;
let currentRoom = null;
let pendingCreateRoomCallback = null;

function handleRoomCallback(success, roomId, error) {
  if (pendingCreateRoomCallback) {
    pendingCreateRoomCallback(
      success ? { success: true, roomId } : { success: false, error },
    );
    pendingCreateRoomCallback = null;
  }
}

function connectToServer(roomId, isHost) {
  if (ws && ws.readyState === WebSocket.OPEN && currentRoom === roomId) return;
  if (ws) ws.close();

  ws = new WebSocket("wss://lets-watch-ffrj.onrender.com/ws");
  currentRoom = roomId;

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: isHost ? "CREATE_ROOM" : "JOIN_ROOM",
        roomId: roomId || "",
        data: {},
      }),
    );
    keepAlive();
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "ROOM_CREATED" || message.type === "ROOM_JOINED") {
        handleRoomCallback(true, message.roomId);
        currentRoom = message.roomId;
      } else if (message.type === "ROOM_ERROR") {
        handleRoomCallback(false, null, message.error);
      } else if (
        message.type === "VIDEO_STATE_CHANGE" &&
        message.roomId === currentRoom
      ) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, message);
          }
        });
      }
    } catch (error) {
      console.error("Error processing message:", error, event.data);
    }
  };

  ws.onclose = ws.onerror = () => {
    ws = null;
    currentRoom = null;
    handleRoomCallback(false, null, "Connection closed or error");
  };
}

chrome.runtime.onMessage.addListener((message, sender, senderResponse) => {
  switch (message.type) {
    case "CREATE_ROOM":
      pendingCreateRoomCallback = senderResponse;
      connectToServer(null, true);
      break;
    case "JOIN_ROOM":
      pendingCreateRoomCallback = senderResponse;
      connectToServer(message.roomId, false);
      break;
    case "VIDEO_STATE_CHANGE":
      if (ws && ws.readyState === WebSocket.OPEN && currentRoom) {
        ws.send(
          JSON.stringify({
            type: "VIDEO_STATE_CHANGE",
            roomId: currentRoom,
            data: message.data,
          }),
        );
      }
      break;
    default:
      break;
  }
  return true;
});

function keepAlive() {
  const keepAliveIntervalId = setInterval(
    () => {
      if (ws) {
        ws.send(JSON.stringify({ type: "PING_KEEPALIVE" }));
      } else {
        clearInterval(keepAliveIntervalId);
      }
    },
    // Set the internval to 20 secondsd to prevent the service worker from becoming inactive.
    20 * 1000,
  );
}
