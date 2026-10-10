let panelIframe = null;

function createPanel() {
  if (panelIframe) return;

  panelIframe = document.createElement("iframe");
  panelIframe.id = "sidekick-panel-frame";
  panelIframe.src = chrome.runtime.getURL("panel.html");
  panelIframe.classList.add("sidekick-panel", "sidekick-right"); // Default orientation

  document.body.appendChild(panelIframe);
}

function removePanel() {
  if (panelIframe) {
    panelIframe.remove();
    panelIframe = null;
    document.body.style.margin = "0"; // Reset margin adjustments
  }
}

// Listen for requests from background or panel script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggle-panel") {
    if (panelIframe) {
      removePanel();
    } else {
      createPanel();
    }
  }
});

// Listen for frame-repositioning events from panel.js
window.addEventListener("message", (event) => {
  if (event.data && event.data.action === "change-dock") {
    const position = event.data.position; // 'left', 'right', 'top', 'bottom'
    if (!panelIframe) return;

    // Reset styles
    panelIframe.className = "sidekick-panel";
    document.body.style.marginLeft = "0";
    document.body.style.marginRight = "0";
    document.body.style.marginTop = "0";
    document.body.style.marginBottom = "0";

    panelIframe.classList.add(`sidekick-${position}`);

    // Adjust page content to prevent overlap
    if (position === "left") {
      document.body.style.marginLeft = "380px";
    } else if (position === "right") {
      document.body.style.marginRight = "380px";
    } else if (position === "top") {
      document.body.style.marginTop = "280px";
    } else if (position === "bottom") {
      document.body.style.marginBottom = "280px";
    }
  }
});