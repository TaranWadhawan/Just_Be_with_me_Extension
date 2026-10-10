// Toggle panel visibility when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  // First, attempt to send the toggle message
  chrome.tabs.sendMessage(tab.id, { action: "toggle-panel" })
    .catch((err) => {
      // If the receiving end doesn't exist, try to dynamically inject the scripts
      console.log("Content script not active. Attempting to inject dynamically...");
      
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      })
      .then(() => {
        return chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content.css"]
        });
      })
      .then(() => {
        // Once successfully injected, retry sending the toggle message
        return chrome.tabs.sendMessage(tab.id, { action: "toggle-panel" });
      })
      .catch((injectionError) => {
        console.warn(
          "Sidekick cannot run on this page. Script injection is restricted on system pages (e.g., chrome://) and the Chrome Web Store.",
          injectionError.message
        );
      });
    });
});

// Handle alarm setups from the panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "set-alarm") {
    const { id, title, time } = request.data;
    chrome.alarms.create(id, { when: time });
    sendResponse({ success: true });
  } else if (request.action === "clear-alarm") {
    chrome.alarms.clear(request.id);
    sendResponse({ success: true });
  }
});

// Listen for alarms and trigger notifications
chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.storage.local.get({ reminders: [] }, (result) => {
    const reminder = result.reminders.find(r => r.id === alarm.name);
    if (reminder) {
      chrome.notifications.create(alarm.name, {
        type: "basic",
        iconUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 24 24' fill='%234F46E5'><path d='M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z'/></svg>",
        title: "Sidekick Reminder",
        message: reminder.text,
        priority: 2
      });
      
      const updated = result.reminders.filter(r => r.id !== alarm.name);
      chrome.storage.local.set({ reminders: updated });
    }
  });
});