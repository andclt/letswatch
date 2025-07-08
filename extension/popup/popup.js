/**
 * Let's Watch Together - Chrome Extension Popup
 * Handles room creation, joining, and UI interactions
 */

document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const createRoomBtn = document.getElementById("createRoom");
  const joinRoomBtn = document.getElementById("joinRoom");
  const roomIdInput = document.getElementById("roomId");
  const statusDiv = document.getElementById("status");
  const roomInfoDiv = document.getElementById("roomInfo");
  const currentRoomIdSpan = document.getElementById("currentRoomId");
  const copyRoomIdBtn = document.getElementById("copyRoomId");

  let currentRoomId = null;

  /**
   * Show status message with animation and auto-hide
   * @param {string} message - The message to display
   * @param {string} type - Message type: 'success', 'error', 'warning'
   * @param {number} duration - How long to show the message (ms)
   */
  function showStatus(message, type = "success", duration = 3000) {
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type} show`;

    setTimeout(() => {
      statusDiv.className = "status-message";
    }, duration);
  }

  function updateRoomInfo(roomId) {
    currentRoomId = roomId;

    if (roomId) {
      roomInfoDiv.style.display = "block";
      currentRoomIdSpan.textContent = roomId;
    } else {
      roomInfoDiv.style.display = "none";
      currentRoomIdSpan.textContent = "";
    }
  }

  async function copyRoomId() {
    if (!currentRoomId) {
      showStatus("No room ID to copy", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(currentRoomId);
      showStatus("Room ID copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy room ID:", error);
      showStatus("Faield to copy room ID to clipboard!");
    }
  }

  async function createRoom() {
    try {
      createRoomBtn.disabled = true;
      createRoomBtn.textContent = "Creating...";

      chrome.runtime.sendMessage(
        {
          type: "CREATE_ROOM",
        },
        (response) => {
          if (response && response.success && response.roomId) {
            chrome.storage.local.set({ roomId: response.roomId }, () => {
              updateRoomInfo(response.roomId);
              showStatus("Room created successfully!");
            });
          } else {
            showStatus("Failed to create room", "error");
          }
        },
      );
    } catch (error) {
      console.error("Failed to create room:", error);
      showStatus("Failed to create room", "error");
    } finally {
      createRoomBtn.disabled = false;
      createRoomBtn.innerHTML =
        '<span class="btn-icon">🎬</span>Create Watch Party';
    }
  }

  async function joinRoom() {
    const roomId = roomIdInput.value.trim();

    if (!roomId) {
      showStatus("Please enter a room ID", "error");
      roomIdInput.focus();
      return;
    }

    if (roomId.length < 32) {
      showStatus("Room ID must has to be 32 characters", "error");
      roomIdInput.focus();
      return;
    }

    try {
      joinRoomBtn.disabled = true;
      joinRoomBtn.textContent = "Joining...";

      roomIdInput.value = "";

      chrome.runtime.sendMessage(
        {
          type: "JOIN_ROOM",
          roomId: roomId,
        },
        (response) => {
          if (response && response.success && response.roomId) {
            chrome.storage.local.set({ roomId: response.roomId }, () => {
              updateRoomInfo(roomId);
              showStatus("Room joined successfully!");
            });
          } else {
            showStatus("Failed to join room", "error");
          }
        },
      );
    } catch (error) {
      console.error("Failed to join room:", error);
      showStatus("Failed to join room", "error");
    } finally {
      joinRoomBtn.disabled = false;
      joinRoomBtn.innerHTML =
        '<span class="btn-icon">👥</span>Join Watch Party';
    }
  }

  async function initialize() {
    try {
      const result = await chrome.storage.local.get(["roomId"]);
      if (result.roomId) {
        updateRoomInfo(result.roomId);
      }
    } catch (error) {
      console.error("Failed to initialize popup:", error);
    }
  }

  createRoomBtn.addEventListener("click", createRoom);
  joinRoomBtn.addEventListener("click", joinRoom);
  copyRoomIdBtn.addEventListener("click", copyRoomId);

  // Handle keyboard enter key for joining room
  roomIdInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !joinRoomBtn.disabled) {
      joinRoom();
    }
  });

  initialize();
});
