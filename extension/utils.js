let _cachedPlayer = null;

function getPlayer() {
  if (_cachedPlayer && document.body.contains(_cachedPlayer)) {
    return _cachedPlayer;
  }

  const selectors = [
    "#movie_player",
    ".html5-video-player",
    'video[src*="googlevideo.com"]',
  ];

  let player = null;
  for (const selector of selectors) {
    player = document.querySelector(selector);
    if (player) break;
  }

  if (player && player.tagName === "VIDEO") {
    player = player.closest('div[id*="player"]');
  }

  _cachedPlayer = player;
  return _cachedPlayer;
}

function getVideoElement() {
  const player = getPlayer();
  if (!player) return null;

  return player.querySelector("video.html5-main-video, video");
}

function checkAdStatus() {
  const player = getPlayer();
  if (!player) return false;

  if (
    player.classList.contains("ad-showing") ||
    player.classList.contains("ad-interrupting")
  ) {
    return true;
  }

  const adElementSelectors = [
    ".video-ads.ytp-ad-module",
    ".ytp-ad-player-overlay",
    ".ytp-ad-skip-button-container",
    ".ytp-ad-text",
    ".ytp-ad-preview-text",
  ];

  return adElementSelectors.some((selector) => {
    const adElement = player.querySelector(selector);
    return adElement && getComputedStyle(adElement).display !== "none";
  });
}

function showNotification(message) {
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 50px;
    right: 10px;
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    z-index: 9999,
    font-family: Arial, sans-serif;
    `;
  notification.textContent = `LWT: ${message}`;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}
