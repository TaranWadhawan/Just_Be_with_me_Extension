let panelIframe = null;
let resizerElement = null;
let currentPosition = "right";

function createPanel() {
  if (panelIframe) return;

  // 1. Create main Iframe container with media permissions allowed
  panelIframe = document.createElement("iframe");
  panelIframe.id = "sidekick-panel-frame";
  panelIframe.src = chrome.runtime.getURL("panel.html");
  panelIframe.classList.add("sidekick-panel", `sidekick-${currentPosition}`);
  
  // CRITICAL: Explicitly allow microphone and screen capturing permissions within our host iframe context
  panelIframe.setAttribute("allow", "microphone; display-capture;");
  document.body.appendChild(panelIframe);

  // 2. Create resizer handle
  resizerElement = document.createElement("div");
  resizerElement.id = "sidekick-drag-handle";
  resizerElement.className = `sidekick-resizer-${currentPosition}`;
  document.body.appendChild(resizerElement);

  setupResizer();
  applyMargins();
}

function removePanel() {
  if (panelIframe) panelIframe.remove();
  if (resizerElement) resizerElement.remove();
  panelIframe = null;
  resizerElement = null;
  resetBodyMargins();
}

function resetBodyMargins() {
  document.body.style.marginLeft = "0";
  document.body.style.marginRight = "0";
  document.body.style.marginTop = "0";
  document.body.style.marginBottom = "0";
}

function applyMargins() {
  resetBodyMargins();
  if (!panelIframe) return;
  if (panelIframe.classList.contains("sidekick-fullscreen")) return;

  const rect = panelIframe.getBoundingClientRect();
  if (currentPosition === "left") {
    document.body.style.marginLeft = `${rect.width}px`;
  } else if (currentPosition === "right") {
    document.body.style.marginRight = `${rect.width}px`;
  } else if (currentPosition === "top") {
    document.body.style.marginTop = `${rect.height}px`;
  } else if (currentPosition === "bottom") {
    document.body.style.marginBottom = `${rect.height}px`;
  }
}

function setupResizer() {
  let startX, startY, startWidth, startHeight;

  function onMouseDown(e) {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    const rect = panelIframe.getBoundingClientRect();
    startWidth = rect.width;
    startHeight = rect.height;

    panelIframe.style.pointerEvents = "none";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e) {
    if (currentPosition === "right") {
      const newWidth = Math.max(280, Math.min(800, startWidth + (startX - e.clientX)));
      panelIframe.style.width = `${newWidth}px`;
    } else if (currentPosition === "left") {
      const newWidth = Math.max(280, Math.min(800, startWidth + (e.clientX - startX)));
      panelIframe.style.width = `${newWidth}px`;
    } else if (currentPosition === "top") {
      const newHeight = Math.max(180, Math.min(600, startHeight + (e.clientY - startY)));
      panelIframe.style.height = `${newHeight}px`;
    } else if (currentPosition === "bottom") {
      const newHeight = Math.max(180, Math.min(600, startHeight + (startY - e.clientY)));
      panelIframe.style.height = `${newHeight}px`;
    }
    applyMargins();
    updateResizerPosition();
  }

  function onMouseUp() {
    panelIframe.style.pointerEvents = "auto";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  resizerElement.addEventListener("mousedown", onMouseDown);
  updateResizerPosition();
}

function updateResizerPosition() {
  if (!panelIframe || !resizerElement) return;
  const rect = panelIframe.getBoundingClientRect();

  resizerElement.className = `sidekick-resizer-${currentPosition}`;

  if (currentPosition === "right") {
    resizerElement.style.top = "0";
    resizerElement.style.bottom = "0";
    resizerElement.style.left = `${rect.left}px`;
    resizerElement.style.right = "auto";
    resizerElement.style.width = "6px";
    resizerElement.style.height = "auto";
  } else if (currentPosition === "left") {
    resizerElement.style.top = "0";
    resizerElement.style.bottom = "0";
    resizerElement.style.left = "auto";
    resizerElement.style.right = `${window.innerWidth - rect.right}px`;
    resizerElement.style.width = "6px";
    resizerElement.style.height = "auto";
  } else if (currentPosition === "top") {
    resizerElement.style.top = `${rect.height}px`;
    resizerElement.style.bottom = "auto";
    resizerElement.style.left = "0";
    resizerElement.style.right = "0";
    resizerElement.style.width = "auto";
    resizerElement.style.height = "6px";
  } else if (currentPosition === "bottom") {
    resizerElement.style.top = "auto";
    resizerElement.style.bottom = `${rect.height}px`;
    resizerElement.style.left = "0";
    resizerElement.style.right = "0";
    resizerElement.style.width = "auto";
    resizerElement.style.height = "6px";
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "toggle-panel") {
    if (panelIframe) removePanel();
    else createPanel();
  }
});

window.addEventListener("message", (event) => {
  if (!event.data || !panelIframe) return;

  if (event.data.action === "change-dock") {
    currentPosition = event.data.position;
    panelIframe.className = "sidekick-panel";
    panelIframe.removeAttribute("style");
    panelIframe.classList.add(`sidekick-${currentPosition}`);
    applyMargins();
    updateResizerPosition();
  }

  if (event.data.action === "toggle-fullscreen") {
    const isFullscreen = event.data.enabled;
    if (isFullscreen) {
      panelIframe.classList.add("sidekick-fullscreen");
      resizerElement.style.display = "none";
    } else {
      panelIframe.classList.remove("sidekick-fullscreen");
      resizerElement.style.display = "block";
    }
    applyMargins();
    updateResizerPosition();
  }

  if (event.data.action === "close-panel") {
    removePanel();
  }
});