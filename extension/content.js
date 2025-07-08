const MESSAGE_TYPE = "VIDEO_STATE_CHANGE";
const STORAGE_NAMESPACE = "local";
const SEEK_TOLERANCE_S = 1.5;
const AD_STATE_TIMESTAMP = -1;
const INIT_POLL_INTERVAL_MS = 1000;
const MAX_INIT_ATTEMPTS = 20;
const AD_FINISH_DEBOUNCE_MS = 1000;
const INITIAL_SYNC_DELAY_MS = 500;
const REMOTE_STATE_FLAG_DURATION_MS = 200;

let roomId = null;
let isLocalUserWatchingAd = false;
let isApplyingRemoteState = false;
let adObserver = null;
let videoElement = null;

function sendMessage(data) {
  if (!roomId) return;
  chrome.runtime.sendMessage({
    type: MESSAGE_TYPE,
    roomId: roomId,
    data: data,
  });
}

function handleLocalStateChange() {
  if (
    isApplyingRemoteState ||
    !roomId ||
    !videoElement ||
    isLocalUserWatchingAd
  ) {
    return;
  }
  sendMessage({
    currentTime: videoElement.currentTime,
    isPaused: videoElement.paused,
  });
}

function handleRemoteStateChange(data) {
  if (!videoElement || isLocalUserWatchingAd) {
    if (isLocalUserWatchingAd)
      showNotification("Ad playing, incoming sync ignored.");
    return;
  }

  const seekNeeded =
    data.currentTime !== AD_STATE_TIMESTAMP &&
    Math.abs(videoElement.currentTime - data.currentTime) > SEEK_TOLERANCE_S;

  const playPauseNeeded = videoElement.paused !== data.isPaused;

  if (!seekNeeded && !playPauseNeeded) return;

  showNotification(
    `Syncing: ${data.isPaused ? "Pause" : "Play"} @ ${data.currentTime.toFixed(1)}s`,
  );

  isApplyingRemoteState = true;

  if (seekNeeded) {
    videoElement.currentTime = data.currentTime;
  }

  if (playPauseNeeded) {
    if (data.isPaused) {
      videoElement.pause();
    } else {
      if (checkAdStatus()) {
        if (!videoElement.paused) videoElement.pause();
      } else {
        videoElement.play().catch((e) => console.warn("LWT: Play failed", e));
      }
    }
  }

  setTimeout(() => {
    isApplyingRemoteState = false;
  }, REMOTE_STATE_FLAG_DURATION_MS);
}

function handleAdStateChange(isAdNowPlaying) {
  if (!videoElement || !roomId) return;
  const adStarted = isAdNowPlaying && !isLocalUserWatchingAd;
  const adFinished = !isAdNowPlaying && isLocalUserWatchingAd;

  if (adStarted) {
    isLocalUserWatchingAd = true;
    showNotification("Your ad started. Pausing for others.");
    sendMessage({ currentTime: AD_STATE_TIMESTAMP, isPaused: true });
  } else if (adFinished) {
    isLocalUserWatchingAd = false;
    setTimeout(() => {
      if (!getVideoElement()) return;
      showNotification("Your ad finished. Syncing video state.");
      videoElement
        .play()
        .then(handleLocalStateChange)
        .catch((e) => console.warn("LWT: Play failed after ad", e));
    }, AD_FINISH_DEBOUNCE_MS);
  }
}

function setupAdObserver() {
  const playerElement = getPlayer();
  if (!playerElement) return;
  if (adObserver) adObserver.disconnect();
  const observerCallback = () => handleAdStateChange(checkAdStatus());
  adObserver = new MutationObserver(observerCallback);
  adObserver.observe(playerElement, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["class", "style"],
  });
  observerCallback();
}

function initialize() {
  videoElement = getVideoElement();
  if (!videoElement) {
    showNotification("Could not find the video player.");
    return;
  }
  chrome.storage.local.get(["roomId"], (result) => {
    roomId = result.roomId || null;
    showNotification(roomId ? `Current Room ID: ${roomId}` : "No Room ID set.");
    videoElement.addEventListener("play", handleLocalStateChange);
    videoElement.addEventListener("pause", handleLocalStateChange);
    videoElement.addEventListener("seeked", handleLocalStateChange);
    setupAdObserver();
    if (!isLocalUserWatchingAd) {
      setTimeout(handleLocalStateChange, INITIAL_SYNC_DELAY_MS);
    }
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === MESSAGE_TYPE && message.roomId === roomId) {
    handleRemoteStateChange(message.data);
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === STORAGE_NAMESPACE && changes.roomId) {
    const oldRoomId = roomId;
    roomId = changes.roomId.newValue;
    showNotification(
      `Room ID ${oldRoomId ? "updated to" : "set to"}: ${roomId || "None"}`,
    );
    if (roomId && videoElement) {
      if (isLocalUserWatchingAd) {
        sendMessage({ currentTime: videoElement.currentTime, isPaused: true });
      } else if (!videoElement.paused) {
        handleLocalStateChange();
      }
    }
  }
});

let initializeAttempts = 0;
const initializationPoller = setInterval(() => {
  initializeAttempts++;
  const video = getVideoElement();
  if (video && video.readyState >= 1) {
    clearInterval(initializationPoller);
    initialize();
  } else if (initializeAttempts >= MAX_INIT_ATTEMPTS) {
    clearInterval(initializationPoller);
    showNotification(
      "Could not initialize video player after multiple attempts.",
    );
  }
}, INIT_POLL_INTERVAL_MS);
