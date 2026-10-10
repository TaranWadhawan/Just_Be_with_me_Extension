// App State Properties (Loaded dynamically from storage)
let appState = {
  onenotePages: [],
  activePageId: null,
  keepNotes: [],
  docsContent: "",
  flashcardDecks: [],
  activeDeckId: null,
  routines: [],
  reminders: [],
  schedulerTasks: [], // [{ id, title, priority, timeNeeded, effort, deadline }]
  calendarEvents: {}  // Map format: { "YYYY-MM-DD": ["Event description"] }
};

// UI Global Navigation and Module Handlers
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  loadData();
  setupTabs();
  setupOneNote();
  setupKeep();
  setupDocs();
  setupFlashcardStudyEngine();
  setupCanvas();
  setupWorkspaceTools();
  setupRemindersAndRoutines();
  setupDockControls();
  setupFocusMode();
  setupUnifiedSearch();
  setupCalendarWidget();
  setupAdvancedScheduler();
});

// ---- MINIMIZE/CLOSE PANEL ----
const closeBtn = document.getElementById("close-panel-btn");
if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    window.parent.postMessage({ action: "close-panel" }, "*");
  });
}

// ---- THEME ENGINE ----
function initTheme() {
  const themeSelect = document.getElementById("theme-select");
  chrome.storage.local.get({ appTheme: "system" }, (data) => {
    themeSelect.value = data.appTheme;
    applyTheme(data.appTheme);
  });
  themeSelect.addEventListener("change", (e) => {
    const selected = e.target.value;
    chrome.storage.local.set({ appTheme: selected }, () => {
      applyTheme(selected);
    });
  });
}

function applyTheme(theme) {
  const htmlEl = document.documentElement;
  if (theme === "system") {
    htmlEl.removeAttribute("data-theme");
  } else {
    htmlEl.setAttribute("data-theme", theme);
  }
}

// ---- APP GENERAL DATA LOAD ----
function loadData() {
  chrome.storage.local.get({
    onenotePages: [],
    activePageId: null,
    keepNotes: [],
    docsContent: "",
    flashcardDecks: [],
    activeDeckId: null,
    routines: [],
    reminders: [],
    schedulerTasks: [],
    calendarEvents: {}
  }, (data) => {
    appState = data;
    
    renderOneNoteSidebar();
    renderOneNoteActivePage();
    renderKeepNotes();
    
    const editor = document.getElementById("docs-editor");
    editor.innerHTML = appState.docsContent || "";
    
    renderFlashcardDeckDropdown();
    renderActiveFlashcard();
    renderRoutines();
    renderReminders();
    
    renderSchedulerTasks();
    renderCalendar();
    
    startReminderCheckingDaemon();
  });
}

function saveData(key, value) {
  appState[key] = value;
  chrome.storage.local.set({ [key]: value });
}

// ---- WINDOW TOGGLING & NAVIGATION ----
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const panes = document.querySelectorAll(".tab-pane");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      panes.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const targetPane = document.getElementById(`tab-${tab.getAttribute("data-tab")}`);
      if (targetPane) {
        targetPane.classList.add("active");
      }
      if (tab.getAttribute("data-tab") === "canvas") {
        setTimeout(handleCanvasResize, 100);
      }
    });
  });
}

// ---- FOCUS MODE ----
function setupFocusMode() {
  const focusBtn = document.getElementById("focus-mode-btn");
  let focusEnabled = false;

  focusBtn.addEventListener("click", () => {
    focusEnabled = !focusEnabled;
    if (focusEnabled) {
      focusBtn.textContent = "📺 Normal Mode";
      focusBtn.classList.add("active");
    } else {
      focusBtn.textContent = "📺 Focus Mode";
      focusBtn.classList.remove("active");
    }
    window.parent.postMessage({ action: "toggle-fullscreen", enabled: focusEnabled }, "*");
  });
}

// ---- DOCK MANAGEMENT ----
function setupDockControls() {
  const dockSelect = document.getElementById("dock-select");
  dockSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    window.parent.postMessage({ action: "change-dock", position: val }, "*");
    chrome.storage.local.set({ savedDockPosition: val });
  });

  chrome.storage.local.get("savedDockPosition", (data) => {
    if (data.savedDockPosition) {
      dockSelect.value = data.savedDockPosition;
      window.parent.postMessage({ action: "change-dock", position: data.savedDockPosition }, "*");
    }
  });
}

// ---- ONENOTE MODULE ----
function setupOneNote() {
  const addBtn = document.getElementById("add-section-btn");
  const titleInput = document.getElementById("onenote-title-input");
  const bodyInput = document.getElementById("onenote-body-input");

  addBtn.addEventListener("click", () => {
    const newPage = { id: Date.now().toString(), title: "Untitled Page", body: "" };
    appState.onenotePages.push(newPage);
    appState.activePageId = newPage.id;
    
    saveData("onenotePages", appState.onenotePages);
    saveData("activePageId", appState.activePageId);
    
    renderOneNoteSidebar();
    renderOneNoteActivePage();
  });

  titleInput.addEventListener("input", (e) => {
    const active = appState.onenotePages.find(p => p.id === appState.activePageId);
    if (active) {
      active.title = e.target.value || "Untitled Page";
      saveData("onenotePages", appState.onenotePages);
      updateSidebarItemName(active.id, active.title);
    }
  });

  bodyInput.addEventListener("input", (e) => {
    const active = appState.onenotePages.find(p => p.id === appState.activePageId);
    if (active) {
      active.body = e.target.value;
      saveData("onenotePages", appState.onenotePages);
    }
  });
}

function renderOneNoteSidebar() {
  const container = document.getElementById("onenote-pages");
  container.innerHTML = "";
  appState.onenotePages.forEach(p => {
    const li = document.createElement("li");
    li.className = `sidebar-item ${p.id === appState.activePageId ? "active" : ""}`;
    li.id = `sidebar-item-${p.id}`;
    
    li.innerHTML = `
      <span class="sidebar-item-text">${escapeHTML(p.title)}</span>
      <button class="delete-page-btn" title="Delete Notebook Page">&times;</button>
    `;

    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-page-btn")) return;
      appState.activePageId = p.id;
      saveData("activePageId", p.id);
      document.querySelectorAll(".sidebar-item").forEach(item => item.classList.remove("active"));
      li.classList.add("active");
      renderOneNoteActivePage();
    });

    li.querySelector(".delete-page-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      appState.onenotePages = appState.onenotePages.filter(item => item.id !== p.id);
      if (appState.activePageId === p.id) {
        appState.activePageId = appState.onenotePages.length > 0 ? appState.onenotePages[0].id : null;
      }
      saveData("onenotePages", appState.onenotePages);
      saveData("activePageId", appState.activePageId);
      renderOneNoteSidebar();
      renderOneNoteActivePage();
    });

    container.appendChild(li);
  });
}

function renderOneNoteActivePage() {
  const titleInput = document.getElementById("onenote-title-input");
  const bodyInput = document.getElementById("onenote-body-input");
  const active = appState.onenotePages.find(p => p.id === appState.activePageId);

  if (active) {
    titleInput.disabled = false;
    bodyInput.disabled = false;
    titleInput.value = active.title === "Untitled Page" ? "" : active.title;
    bodyInput.value = active.body;
  } else {
    titleInput.disabled = true;
    bodyInput.disabled = true;
    titleInput.value = "Click '+' to create a page";
    bodyInput.value = "";
  }
}

function updateSidebarItemName(id, title) {
  const el = document.getElementById(`sidebar-item-${id}`);
  if (el) {
    const textSpan = el.querySelector(".sidebar-item-text");
    if (textSpan) textSpan.textContent = title;
  }
}

// ---- KEEP MODULE ----
let keepSelectedColor = "default";
function setupKeep() {
  const dots = document.querySelectorAll(".color-dot");
  dots.forEach(dot => {
    dot.addEventListener("click", () => {
      dots.forEach(d => d.classList.remove("active"));
      dot.classList.add("active");
      keepSelectedColor = dot.getAttribute("data-color");
    });
  });

  document.getElementById("keep-save-btn").addEventListener("click", () => {
    const title = document.getElementById("keep-title").value.trim();
    const text = document.getElementById("keep-text").value.trim();
    if (!title && !text) return;

    const note = { id: Date.now().toString(), title, text, color: keepSelectedColor };
    appState.keepNotes.unshift(note);
    saveData("keepNotes", appState.keepNotes);
    renderKeepNotes();

    document.getElementById("keep-title").value = "";
    document.getElementById("keep-text").value = "";
    dots.forEach(d => d.classList.remove("active"));
    dots[0].classList.add("active");
    keepSelectedColor = "default";
  });
}

function renderKeepNotes() {
  const grid = document.getElementById("keep-grid");
  grid.innerHTML = "";

  const colorMapping = {
    yellow: "#fef08a", blue: "#bfdbfe", green: "#bbf7d0", red: "#fecaca", default: "var(--bg-card)"
  };

  appState.keepNotes.forEach(note => {
    const card = document.createElement("div");
    card.className = "keep-card";
    card.style.background = colorMapping[note.color] || colorMapping.default;
    card.innerHTML = `
      <div class="keep-card-title">${escapeHTML(note.title)}</div>
      <div class="keep-card-text">${escapeHTML(note.text)}</div>
      <div class="keep-card-actions"><button class="keep-card-del">Delete</button></div>
    `;
    card.querySelector(".keep-card-del").addEventListener("click", () => {
      appState.keepNotes = appState.keepNotes.filter(n => n.id !== note.id);
      saveData("keepNotes", appState.keepNotes);
      renderKeepNotes();
    });
    grid.appendChild(card);
  });
}

// ---- DOCS MODULE ----
function setupDocs() {
  const editor = document.getElementById("docs-editor");
  const formatButtons = document.querySelectorAll(".format-btn[data-cmd]");

  formatButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const command = btn.getAttribute("data-cmd");
      document.execCommand(command, false, null);
      updateFormatButtonsState();
    });
  });

  editor.addEventListener("keyup", updateFormatButtonsState);
  editor.addEventListener("mouseup", updateFormatButtonsState);

  editor.addEventListener("input", () => {
    saveData("docsContent", editor.innerHTML);
  });

  document.getElementById("doc-export-btn").addEventListener("click", () => {
    const rawText = editor.innerText;
    const blob = new Blob([rawText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Document.txt";
    link.click();
    URL.revokeObjectURL(url);
  });
}

function updateFormatButtonsState() {
  const formats = ["bold", "italic", "underline"];
  formats.forEach(f => {
    const btn = document.getElementById(`format-${f}`);
    if (btn) {
      if (document.queryCommandState(f)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    }
  });
}

// ---- FLASHCARDS MODULE ----
let currentCardIndex = 0;

function setupFlashcardStudyEngine() {
  const addDeckBtn = document.getElementById("add-deck-btn");
  const removeDeckBtn = document.getElementById("remove-deck-btn");
  const deckInput = document.getElementById("deck-name-input");
  const dropdown = document.getElementById("deck-select-dropdown");
  
  const addCardBtn = document.getElementById("add-card-btn");
  const cardFrontInput = document.getElementById("card-front-input");
  const cardBackInput = document.getElementById("card-back-input");

  addDeckBtn.addEventListener("click", () => {
    const title = deckInput.value.trim();
    if (!title) return;
    const newDeck = { id: "deck_" + Date.now(), title, cards: [] };
    appState.flashcardDecks.push(newDeck);
    appState.activeDeckId = newDeck.id;
    
    saveData("flashcardDecks", appState.flashcardDecks);
    saveData("activeDeckId", appState.activeDeckId);
    
    renderFlashcardDeckDropdown();
    deckInput.value = "";
    currentCardIndex = 0;
    renderActiveFlashcard();
  });

  // Deck Deletion Functionality
  removeDeckBtn.addEventListener("click", () => {
    if (!appState.activeDeckId) return;
    appState.flashcardDecks = appState.flashcardDecks.filter(d => d.id !== appState.activeDeckId);
    appState.activeDeckId = appState.flashcardDecks.length > 0 ? appState.flashcardDecks[0].id : null;
    
    saveData("flashcardDecks", appState.flashcardDecks);
    saveData("activeDeckId", appState.activeDeckId);
    
    renderFlashcardDeckDropdown();
    currentCardIndex = 0;
    renderActiveFlashcard();
  });

  dropdown.addEventListener("change", (e) => {
    appState.activeDeckId = e.target.value;
    saveData("activeDeckId", appState.activeDeckId);
    currentCardIndex = 0;
    renderActiveFlashcard();
  });

  addCardBtn.addEventListener("click", () => {
    const activeDeck = appState.flashcardDecks.find(d => d.id === appState.activeDeckId);
    if (!activeDeck) {
      alert("Please create or select a study deck first.");
      return;
    }

    const front = cardFrontInput.value.trim();
    const back = cardBackInput.value.trim();
    if (!front || !back) return;

    activeDeck.cards.push({ id: "card_" + Date.now(), front, back });
    saveData("flashcardDecks", appState.flashcardDecks);

    cardFrontInput.value = "";
    cardBackInput.value = "";
    renderActiveFlashcard();
  });

  const flipBtn = document.getElementById("study-flip-btn");
  const nextBtn = document.getElementById("study-next-btn");
  const prevBtn = document.getElementById("study-prev-btn");
  const viewCardNode = document.getElementById("flashcard-viewer-3d");

  const performFlip = () => viewCardNode.classList.toggle("flipped");
  flipBtn.addEventListener("click", performFlip);
  viewCardNode.addEventListener("click", performFlip);

  nextBtn.addEventListener("click", () => {
    const activeDeck = appState.flashcardDecks.find(d => d.id === appState.activeDeckId);
    if (activeDeck && activeDeck.cards.length > 0) {
      currentCardIndex = (currentCardIndex + 1) % activeDeck.cards.length;
      renderActiveFlashcard();
    }
  });

  prevBtn.addEventListener("click", () => {
    const activeDeck = appState.flashcardDecks.find(d => d.id === appState.activeDeckId);
    if (activeDeck && activeDeck.cards.length > 0) {
      currentCardIndex = (currentCardIndex - 1 + activeDeck.cards.length) % activeDeck.cards.length;
      renderActiveFlashcard();
    }
  });
}

function renderFlashcardDeckDropdown() {
  const dropdown = document.getElementById("deck-select-dropdown");
  dropdown.innerHTML = "";
  
  if (appState.flashcardDecks.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "— No Decks Added Yet —";
    dropdown.appendChild(opt);
    return;
  }

  appState.flashcardDecks.forEach(deck => {
    const opt = document.createElement("option");
    opt.value = deck.id;
    opt.textContent = deck.title;
    if (deck.id === appState.activeDeckId) opt.selected = true;
    dropdown.appendChild(opt);
  });
}

function renderActiveFlashcard() {
  const frontNode = document.getElementById("card-front-node");
  const backNode = document.getElementById("card-back-node");
  const progressFill = document.getElementById("progress-bar-fill");
  const progressText = document.getElementById("study-progress-text");
  const viewCardNode = document.getElementById("flashcard-viewer-3d");

  viewCardNode.classList.remove("flipped");

  const activeDeck = appState.flashcardDecks.find(d => d.id === appState.activeDeckId);
  if (!activeDeck || activeDeck.cards.length === 0) {
    frontNode.textContent = "Create a deck & add cards to start studying!";
    backNode.textContent = "Your answers will appear here.";
    progressFill.style.width = "0%";
    progressText.textContent = "Card 0 of 0";
    return;
  }

  if (currentCardIndex >= activeDeck.cards.length) {
    currentCardIndex = 0;
  }

  const card = activeDeck.cards[currentCardIndex];
  frontNode.textContent = card.front;
  backNode.textContent = card.back;

  const total = activeDeck.cards.length;
  const currentNum = currentCardIndex + 1;
  const percentage = (currentNum / total) * 100;

  progressFill.style.width = `${percentage}%`;
  progressText.textContent = `Card ${currentNum} of ${total}`;
}

// ---- CANVAS SKETCHING (FIXED AND SAFE ON 0 SIZES) ----
let canvas, ctx, drawing = false, canvasTool = "draw";

function setupCanvas() {
  canvas = document.getElementById("rough-board");
  ctx = canvas.getContext("2d");

  chrome.storage.local.get("canvasDataURL", (res) => {
    if (res.canvasDataURL) {
      const img = new Image();
      img.onload = () => {
        if (canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(img, 0, 0);
        }
      };
      img.src = res.canvasDataURL;
    }
  });

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mouseup", stopDraw);
  canvas.addEventListener("mousemove", drawLine);

  canvas.addEventListener("touchstart", (e) => { startDraw(e.touches[0]); });
  canvas.addEventListener("touchend", stopDraw);
  canvas.addEventListener("touchmove", (e) => { drawLine(e.touches[0]); });

  document.getElementById("tool-draw").addEventListener("click", (e) => {
    canvasTool = "draw";
    toggleCanvasToolActive(e.target);
  });
  document.getElementById("tool-erase").addEventListener("click", (e) => {
    canvasTool = "erase";
    toggleCanvasToolActive(e.target);
  });

  document.getElementById("canvas-clear").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    chrome.storage.local.remove("canvasDataURL");
  });

  window.addEventListener("resize", handleCanvasResize);
}

function handleCanvasResize() {
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return; // Prevent 0-size canvas initialization

  // Cache contents before resizing only if width/height are real, preventing crash
  if (canvas.width > 0 && canvas.height > 0) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(canvas, 0, 0);

    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.drawImage(tempCanvas, 0, 0);
  } else {
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
}

function toggleCanvasToolActive(activeBtn) {
  document.querySelectorAll(".tool-btn").forEach(b => {
    if (b.id !== "canvas-clear") b.classList.remove("active");
  });
  activeBtn.classList.add("active");
}

function startDraw(e) {
  drawing = true;
  ctx.beginPath();
  const rect = canvas.getBoundingClientRect();
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function stopDraw() {
  drawing = false;
  ctx.closePath();
  if (canvas.width > 0 && canvas.height > 0) {
    chrome.storage.local.set({ canvasDataURL: canvas.toDataURL() });
  }
}

function drawLine(e) {
  if (!drawing) return;
  const rect = canvas.getBoundingClientRect();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (canvasTool === "erase") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = document.getElementById("canvas-brush").value * 3;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = document.getElementById("canvas-brush").value;
    ctx.strokeStyle = document.getElementById("canvas-color").value;
  }
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  ctx.stroke();
}

// ---- WORKSPACE TOOLS ----
let audioMediaRecorder = null;
let audioChunks = [];

function setupWorkspaceTools() {
  // A. Web Clipper
  const clipPageBtn = document.getElementById("clipper-page-btn");
  const clipSelectionBtn = document.getElementById("clipper-selection-btn");

  clipPageBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab) return;
      const citation = `<p><br></p><blockquote style="border-left: 3px solid var(--primary-color); padding-left: 8px; margin: 8px 0; color: var(--text-muted);">
        <strong>Clipped Reference:</strong><br>
        Title: <a href="${activeTab.url}" target="_blank">${activeTab.title}</a><br>
        Source: ${activeTab.url}
      </blockquote><p><br></p>`;
      
      const editor = document.getElementById("docs-editor");
      editor.innerHTML += citation;
      saveData("docsContent", editor.innerHTML);
      alert("Tab reference successfully clipped to Docs!");
    });
  });

  clipSelectionBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab) return;
      
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => window.getSelection().toString()
      }, (results) => {
        if (!results || !results[0] || !results[0].result) {
          alert("Please highlight text on the web page first.");
          return;
        }
        const highlightedText = results[0].result;
        const noteText = `"${highlightedText}"\n\n— Clipped from: ${activeTab.title} (${activeTab.url})`;

        const keepNote = { id: Date.now().toString(), title: "Clipped Snippet", text: noteText, color: "blue" };
        appState.keepNotes.unshift(keepNote);
        saveData("keepNotes", appState.keepNotes);
        renderKeepNotes();
        alert("Text highlight clipped to Google Keep notes!");
      });
    });
  });

  // B. Song Notes Audio Recorder (Mic & System Audio)
  const recMicBtn = document.getElementById("rec-mic-btn");
  const recSysBtn = document.getElementById("rec-system-btn");
  const recStopBtn = document.getElementById("rec-stop-btn");
  const recStatus = document.getElementById("recorder-status");
  const audioPlayback = document.getElementById("recording-playback");

  async function startRecording(withSystemAudio = false) {
    audioChunks = [];
    let combinedStream;

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (withSystemAudio) {
        const systemStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const systemAudioTrack = systemStream.getAudioTracks()[0];

        if (!systemAudioTrack) {
          alert("System capture did not include sound. Recording microphone only.");
          combinedStream = micStream;
        } else {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const destNode = audioCtx.createMediaStreamDestination();

          const micSource = audioCtx.createMediaStreamSource(micStream);
          const systemSource = audioCtx.createMediaStreamSource(new MediaStream([systemAudioTrack]));

          micSource.connect(destNode);
          systemSource.connect(destNode);

          combinedStream = destNode.stream;
          systemStream.getVideoTracks().forEach(track => track.stop());
        }
      } else {
        combinedStream = micStream;
      }

      audioMediaRecorder = new MediaRecorder(combinedStream);
      audioMediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      audioMediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPlayback.src = audioUrl;
        audioPlayback.style.display = "block";
        recStatus.textContent = "Status: Idle (Recording Saved)";
        recStatus.className = "recorder-status-inactive";

        combinedStream.getTracks().forEach(track => track.stop());
      };

      audioMediaRecorder.start();
      recStatus.textContent = "Status: Recording 🔴";
      recStatus.className = "recorder-status-active";
      recMicBtn.disabled = true;
      recSysBtn.disabled = true;
      recStopBtn.disabled = false;

    } catch (err) {
      console.error("Audio capturing failed", err);
      alert("Failed to access sound devices: Permission denied. Please allow microphone permissions and enable 'Share audio' when recording system sound.");
    }
  }

  recMicBtn.addEventListener("click", () => startRecording(false));
  recSysBtn.addEventListener("click", () => startRecording(true));

  recStopBtn.addEventListener("click", () => {
    if (audioMediaRecorder && audioMediaRecorder.state !== "inactive") {
      audioMediaRecorder.stop();
      recMicBtn.disabled = false;
      recSysBtn.disabled = false;
      recStopBtn.disabled = true;
    }
  });

  // C. Stopwatch & Countdown timing subtabs
  const subtabs = document.querySelectorAll(".sub-btn");
  const clockPanels = document.querySelectorAll(".clock-panel-inner");

  subtabs.forEach(btn => {
    btn.addEventListener("click", () => {
      subtabs.forEach(b => b.classList.remove("active"));
      clockPanels.forEach(p => p.classList.add("hidden"));

      btn.classList.add("active");
      const targetView = document.getElementById(`clock-${btn.id.split("-")[1]}-view`);
      if (targetView) targetView.classList.remove("hidden");
    });
  });

  setupPomodoroTimer();
  setupCountdownTimer();
  setupStopwatch();

  // D. Memory Storage Cleaner Trigger
  const cleanCacheBtn = document.getElementById("sys-clear-storage");
  cleanCacheBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all notes, flashcards, scheduler tasks, and drawing canvases? This action cannot be undone.")) {
      chrome.storage.local.clear(() => {
        alert("Cache cleared successfully. Reloading workspace...");
        location.reload();
      });
    }
  });
}

// 1. Pomodoro Timer
let pomoInterval = null;
let pomoSeconds = 1500;
let pomoIsRunning = false;

function setupPomodoroTimer() {
  const display = document.getElementById("pomo-clock");
  const start = document.getElementById("pomo-start-btn");
  const pause = document.getElementById("pomo-pause-btn");
  const reset = document.getElementById("pomo-reset-btn");

  const render = () => {
    const mins = Math.floor(pomoSeconds / 60).toString().padStart(2, "0");
    const secs = (pomoSeconds % 60).toString().padStart(2, "0");
    display.textContent = `${mins}:${secs}`;
  };

  start.addEventListener("click", () => {
    if (pomoIsRunning) return;
    pomoIsRunning = true;
    pomoInterval = setInterval(() => {
      if (pomoSeconds > 0) {
        pomoSeconds--;
        render();
      } else {
        clearInterval(pomoInterval);
        pomoIsRunning = false;
        triggerScreenModalAlert("Pomodoro focus session completed! Time for a short break.");
        pomoSeconds = 1500;
        render();
      }
    }, 1000);
  });

  pause.addEventListener("click", () => {
    clearInterval(pomoInterval);
    pomoIsRunning = false;
  });

  reset.addEventListener("click", () => {
    clearInterval(pomoInterval);
    pomoIsRunning = false;
    pomoSeconds = 1500;
    render();
  });
}

// 2. Countdown Timer
let countdownInterval = null;
let countdownSecs = 300;
let countdownRunning = false;

function setupCountdownTimer() {
  const display = document.getElementById("timer-clock");
  const start = document.getElementById("timer-start-btn");
  const pause = document.getElementById("timer-pause-btn");
  const reset = document.getElementById("timer-reset-btn");

  const render = () => {
    const mins = Math.floor(countdownSecs / 60).toString().padStart(2, "0");
    const secs = (countdownSecs % 60).toString().padStart(2, "0");
    display.textContent = `${mins}:${secs}`;
  };

  start.addEventListener("click", () => {
    if (countdownRunning) return;
    
    const inputMins = parseInt(document.getElementById("timer-input-mins").value) || 0;
    const inputSecs = parseInt(document.getElementById("timer-input-secs").value) || 0;
    
    if (countdownSecs === 300) {
      countdownSecs = (inputMins * 60) + inputSecs;
    }

    if (countdownSecs <= 0) return;

    countdownRunning = true;
    render();

    countdownInterval = setInterval(() => {
      if (countdownSecs > 0) {
        countdownSecs--;
        render();
      } else {
        clearInterval(countdownInterval);
        countdownRunning = false;
        triggerScreenModalAlert("Countdown Timer Finished!");
        countdownSecs = 300;
        render();
      }
    }, 1000);
  });

  pause.addEventListener("click", () => {
    clearInterval(countdownInterval);
    countdownRunning = false;
  });

  reset.addEventListener("click", () => {
    clearInterval(countdownInterval);
    countdownRunning = false;
    countdownSecs = 300;
    render();
  });
}

// 3. Stopwatch
let stopwatchInterval = null;
let stopwatchMs = 0;
let stopwatchRunning = false;

function setupStopwatch() {
  const display = document.getElementById("stopwatch-clock");
  const start = document.getElementById("stopwatch-start-btn");
  const pause = document.getElementById("stopwatch-pause-btn");
  const reset = document.getElementById("stopwatch-reset-btn");

  const render = () => {
    const totalSecs = Math.floor(stopwatchMs / 100);
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, "0");
    const secs = (totalSecs % 60).toString().padStart(2, "0");
    const ms = (stopwatchMs % 100).toString().padStart(2, "0");
    display.textContent = `${mins}:${secs}.${ms}`;
  };

  start.addEventListener("click", () => {
    if (stopwatchRunning) return;
    stopwatchRunning = true;
    stopwatchInterval = setInterval(() => {
      stopwatchMs++;
      render();
    }, 10);
  });

  pause.addEventListener("click", () => {
    clearInterval(stopwatchInterval);
    stopwatchRunning = false;
  });

  reset.addEventListener("click", () => {
    clearInterval(stopwatchInterval);
    stopwatchRunning = false;
    stopwatchMs = 0;
    render();
  });
}

// ---- ADVANCED SCHEDULER & WORKLOAD OPTIMIZER ----
function setupAdvancedScheduler() {
  const addBtn = document.getElementById("sched-add-btn");
  
  addBtn.addEventListener("click", () => {
    const title = document.getElementById("sched-title-input").value.trim();
    const priority = document.getElementById("sched-priority-input").value;
    const timeNeeded = parseFloat(document.getElementById("sched-time-input").value) || 1;
    const effort = parseInt(document.getElementById("sched-effort-input").value) || 5;
    const deadline = document.getElementById("sched-deadline-input").value;

    if (!title) return;

    const task = {
      id: "task_" + Date.now(),
      title,
      priority,
      timeNeeded,
      effort,
      deadline: deadline || null,
      completed: false
    };

    appState.schedulerTasks.push(task);
    saveData("schedulerTasks", appState.schedulerTasks);
    
    renderSchedulerTasks();

    // Clear inputs
    document.getElementById("sched-title-input").value = "";
    document.getElementById("sched-time-input").value = "";
    document.getElementById("sched-effort-input").value = "";
    document.getElementById("sched-deadline-input").value = "";
  });
}

function renderSchedulerTasks() {
  const container = document.getElementById("scheduler-items-list");
  container.innerHTML = "";

  // Dynamic sorting priority model: High Priority first, followed by Effort weight
  appState.schedulerTasks.sort((a, b) => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    if (priorityWeight[b.priority] !== priorityWeight[a.priority]) {
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    }
    return b.effort - a.effort;
  });

  appState.schedulerTasks.forEach(task => {
    const el = document.createElement("div");
    el.className = "styled-item";
    
    const deadlineString = task.deadline ? `📅 Due: ${new Date(task.deadline).toLocaleString()}` : "No deadline";
    const statusText = `Priority: ${task.priority.toUpperCase()} | Time: ${task.timeNeeded}h | Effort: ${task.effort}/10`;

    el.innerHTML = `
      <div style="display:flex; align-items:center; gap: 8px;">
        <input type="checkbox" class="item-check" ${task.completed ? "checked" : ""}>
        <div style="display:flex; flex-direction:column;">
          <span style="${task.completed ? "text-decoration: line-through; opacity:0.6;" : ""}">${escapeHTML(task.title)}</span>
          <span style="font-size:0.7rem; color:var(--text-muted);">${statusText}</span>
          <span style="font-size:0.7rem; color:var(--primary-color); font-weight: 600;">${deadlineString}</span>
        </div>
      </div>
      <button class="delete-btn" style="background:var(--danger-color); padding: 4px 8px; font-size: 0.75rem;">Clear</button>
    `;

    el.querySelector(".item-check").addEventListener("change", (e) => {
      task.completed = e.target.checked;
      saveData("schedulerTasks", appState.schedulerTasks);
      renderSchedulerTasks();
    });

    el.querySelector(".delete-btn").addEventListener("click", () => {
      appState.schedulerTasks = appState.schedulerTasks.filter(t => t.id !== task.id);
      saveData("schedulerTasks", appState.schedulerTasks);
      renderSchedulerTasks();
    });

    container.appendChild(el);
  });

  runSmartSchedulerOptimizer();
}

function runSmartSchedulerOptimizer() {
  const advisoryOutput = document.getElementById("optimizer-advisory-output");
  const activeTasks = appState.schedulerTasks.filter(t => !t.completed);
  
  if (activeTasks.length === 0) {
    advisoryOutput.textContent = "Workload balanced. No active focus tasks detected.";
    return;
  }

  let totalHours = 0;
  let totalEffort = 0;
  let deadlineConflictCount = 0;

  activeTasks.forEach(t => {
    totalHours += t.timeNeeded;
    totalEffort += t.effort;

    if (t.deadline) {
      const hoursToDeadline = (new Date(t.deadline).getTime() - Date.now()) / 3600000;
      if (hoursToDeadline > 0 && hoursToDeadline < t.timeNeeded) {
        deadlineConflictCount++; // Deadline approaches faster than the time required to complete the task
      }
    }
  });

  const averageEffort = (totalEffort / activeTasks.length).toFixed(1);
  let feedback = `<strong>Advisory:</strong> Total Estimated Load: ${totalHours} hours. Average Task Effort: ${averageEffort}/10. `;

  // Focus and Schedule Balancing Logic
  if (totalHours > 16) {
    feedback += `<br>⚠️ <span style="color:var(--danger-color); font-weight:bold;">Overload Alert:</span> Workload exceeds recommended limits. Delegate or adjust effort timelines.`;
  } else if (totalHours > 8) {
    feedback += `<br>⚡ <span style="color:var(--primary-color);">Moderate Load:</span> Schedule balanced. Ensure regular breaks during focus periods.`;
  } else {
    feedback += `<br>🌱 <span style="color:#059669;">Optimal Focus Zone:</span> Balanced workload. Ready for peak productivity.`;
  }

  if (deadlineConflictCount > 0) {
    feedback += `<br>🚨 <strong>Conflict Detected:</strong> ${deadlineConflictCount} task(s) have deadlines scheduled with insufficient remaining time based on your estimates!`;
  }

  advisoryOutput.innerHTML = feedback;
}

// ---- INTERACTIVE EVENT CALENDAR WIDGET ----
let calendarYear, calendarMonth;

function setupCalendarWidget() {
  const today = new Date();
  calendarYear = today.getFullYear();
  calendarMonth = today.getMonth();

  document.getElementById("cal-prev-month").addEventListener("click", () => {
    calendarMonth--;
    if (calendarMonth < 0) {
      calendarMonth = 11;
      calendarYear--;
    }
    renderCalendar();
  });

  document.getElementById("cal-next-month").addEventListener("click", () => {
    calendarMonth++;
    if (calendarMonth > 11) {
      calendarMonth = 0;
      calendarYear++;
    }
    renderCalendar();
  });

  // Save Calendar Event Form Handler
  document.getElementById("cal-save-event-btn").addEventListener("click", () => {
    const eventText = document.getElementById("cal-event-text").value.trim();
    const dateKey = document.getElementById("calendar-event-form").getAttribute("data-selected-date");
    if (!eventText || !dateKey) return;

    if (!appState.calendarEvents[dateKey]) {
      appState.calendarEvents[dateKey] = [];
    }
    appState.calendarEvents[dateKey].push(eventText);
    saveData("calendarEvents", appState.calendarEvents);

    document.getElementById("cal-event-text").value = "";
    document.getElementById("calendar-event-form").classList.add("hidden");
    
    renderCalendar();
    alert(`Event saved for ${dateKey}!`);
  });
}

function renderCalendar() {
  const monthTitle = document.getElementById("calendar-month-title");
  const daysGrid = document.getElementById("calendar-days-grid");
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  monthTitle.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

  daysGrid.innerHTML = "";

  const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
  const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const prevMonthTotalDays = new Date(calendarYear, calendarMonth, 0).getDate();

  // Render preceding month's offset days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell other-month";
    cell.textContent = prevMonthTotalDays - i;
    daysGrid.appendChild(cell);
  }

  // Render current month's interactive cells
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell";
    cell.textContent = day;

    const dateKey = `${calendarYear}-${(calendarMonth + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    
    // Highlight days with scheduled events
    if (appState.calendarEvents[dateKey] && appState.calendarEvents[dateKey].length > 0) {
      cell.classList.add("has-event");
    }

    cell.addEventListener("click", () => {
      document.querySelectorAll(".calendar-day-cell").forEach(c => c.classList.remove("selected"));
      cell.classList.add("selected");

      const form = document.getElementById("calendar-event-form");
      form.classList.remove("hidden");
      form.setAttribute("data-selected-date", dateKey);
      document.getElementById("cal-selected-date-label").textContent = `Schedule Event: ${dateKey}`;
    });

    daysGrid.appendChild(cell);
  }
}

// ---- UNIFIED ADVANCED SEARCH UTILITY ----
function setupUnifiedSearch() {
  const triggerBtn = document.getElementById("trigger-search-btn");
  const searchInput = document.getElementById("unified-search-input");
  const typeSelect = document.getElementById("search-type-select");
  const resultsOutput = document.getElementById("search-results-output");

  triggerBtn.addEventListener("click", () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      resultsOutput.classList.add("hidden");
      return;
    }

    resultsOutput.innerHTML = "";
    resultsOutput.classList.remove("hidden");

    const searchType = typeSelect.value;
    let matches = [];

    // Search Source Aggregation
    const sources = [
      ...appState.onenotePages.map(p => ({ title: p.title, body: p.body, type: "OneNote Page", ref: "onenote" })),
      ...appState.keepNotes.map(n => ({ title: n.title, body: n.text, type: "Keep Note", ref: "keep" })),
      ...appState.flashcardDecks.flatMap(d => d.cards.map(c => ({ title: `Flashcard (Deck: ${d.title})`, body: `Q: ${c.front} | A: ${c.back}`, type: "Flashcard", ref: "flashcards" }))),
      ...appState.reminders.map(r => ({ title: "Alert", body: r.text, type: "Reminder Alert", ref: "reminders" }))
    ];

    sources.forEach(source => {
      const combinedText = `${source.title} ${source.body}`.toLowerCase();
      let matchScore = 0;

      if (searchType === "keyword") {
        if (combinedText.includes(query)) matchScore = 1;
      } else if (searchType === "fuzzy") {
        matchScore = fuzzyMatchScore(combinedText, query);
      } else if (searchType === "semantic") {
        matchScore = semanticMockMatchScore(combinedText, query);
      } else if (searchType === "tag") {
        // Tag search matches #word queries
        const targetTag = query.startsWith("#") ? query : "#" + query;
        if (combinedText.includes(targetTag)) matchScore = 1;
      }

      if (matchScore > 0.15) {
        matches.push({ source, score: matchScore });
      }
    });

    if (matches.length === 0) {
      resultsOutput.textContent = "No matches found across workspace.";
      return;
    }

    // Sort by matches score
    matches.sort((a, b) => b.score - a.score);

    matches.forEach(m => {
      const el = document.createElement("div");
      el.className = "search-result-item";
      el.innerHTML = `
        <div style="font-weight:700;">${escapeHTML(m.source.title)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHTML(m.source.body)}</div>
        <div class="search-result-item-meta">Source: ${m.source.type} (Relevance: ${Math.round(m.score * 100)}%)</div>
      `;

      el.addEventListener("click", () => {
        // Automatically switch tabs depending on search output result location
        const tabBtn = document.querySelector(`.tab-btn[data-tab="${m.source.ref}"]`);
        if (tabBtn) tabBtn.click();
        resultsOutput.classList.add("hidden");
        searchInput.value = "";
      });

      resultsOutput.appendChild(el);
    });
  });
}

// Simple Dice-Coefficient Bigram overlap algorithm for fuzzy match scores
function fuzzyMatchScore(str, query) {
  const getPairs = s => {
    const pairs = [];
    for (let i = 0; i < s.length - 1; i++) {
      pairs.push(s.slice(i, i + 2));
    }
    return pairs;
  };

  const strPairs = getPairs(str);
  const queryPairs = getPairs(query);
  if (queryPairs.length === 0) return 0;

  let hits = 0;
  queryPairs.forEach(qp => {
    if (strPairs.includes(qp)) hits++;
  });

  return (2 * hits) / (strPairs.length + queryPairs.length);
}

// Pseudo-Semantic concept mapping search tool (using a synonyms-association dictionary vector)
function semanticMockMatchScore(str, query) {
  const semanticDictionary = {
    "study": ["flashcards", "learn", "card", "quiz", "deck", "biology", "exam"],
    "work": ["task", "scheduler", "prioritize", "due", "deadline", "todo", "keep"],
    "music": ["audio", "song", "recorder", "microphone", "melody", "sound", "lyrics"],
    "notes": ["onenote", "docs", "keep", "write", "text", "formatting", "untitled"]
  };

  let score = 0;
  if (str.includes(query)) score += 0.5;

  for (const [key, synonyms] of Object.entries(semanticDictionary)) {
    if (query.includes(key) || key.includes(query)) {
      synonyms.forEach(syn => {
        if (str.includes(syn)) score += 0.25;
      });
    }
  }
  return Math.min(1, score);
}

// ---- ALERTS & DAEMONS ----
function setupRemindersAndRoutines() {
  document.getElementById("add-routine-btn").addEventListener("click", () => {
    const text = document.getElementById("routine-input").value.trim();
    const alertTime = document.getElementById("routine-alert-time").value;
    if (!text) return;
    
    appState.routines.push({
      id: "routine_" + Date.now(),
      text,
      alertTime: alertTime || null,
      lastAlertDate: null,
      checked: false
    });

    saveData("routines", appState.routines);
    renderRoutines();
    document.getElementById("routine-input").value = "";
    document.getElementById("routine-alert-time").value = "";
  });

  document.getElementById("add-reminder-btn").addEventListener("click", () => {
    const text = document.getElementById("remind-text").value.trim();
    const timeVal = document.getElementById("remind-time").value;
    if (!text || !timeVal) return;

    const epoch = new Date(timeVal).getTime();
    if (epoch <= Date.now()) {
      alert("Please select a target window in the future.");
      return;
    }

    const id = "reminder_" + Date.now();
    const alertItem = { id, text, time: timeVal, epoch };

    appState.reminders.push(alertItem);
    saveData("reminders", appState.reminders);

    chrome.runtime.sendMessage({
      action: "set-alarm",
      data: { id, text, time: epoch }
    }, () => {
      renderReminders();
      document.getElementById("remind-text").value = "";
      document.getElementById("remind-time").value = "";
    });
  });

  document.getElementById("alert-modal-close").addEventListener("click", () => {
    document.getElementById("on-screen-alert-modal").classList.add("hidden");
  });
}

function renderRoutines() {
  const container = document.getElementById("routines-list");
  container.innerHTML = "";

  appState.routines.forEach(item => {
    const el = document.createElement("div");
    el.className = "styled-item";
    const alertMeta = item.alertTime ? `⏰ Daily @ ${item.alertTime}` : "No alert";
    
    el.innerHTML = `
      <div style="display:flex; align-items:center;">
        <input type="checkbox" class="item-check" ${item.checked ? "checked" : ""}>
        <div style="display:flex; flex-direction:column;">
          <span style="${item.checked ? "text-decoration: line-through; opacity:0.6;" : ""}">${escapeHTML(item.text)}</span>
          <span style="font-size:0.7rem; color:var(--text-muted);">${alertMeta}</span>
        </div>
      </div>
      <button class="delete-btn" style="background:var(--danger-color); padding: 4px 8px; font-size: 0.75rem;">Delete</button>
    `;

    el.querySelector(".item-check").addEventListener("change", (e) => {
      item.checked = e.target.checked;
      saveData("routines", appState.routines);
      renderRoutines();
    });

    el.querySelector(".delete-btn").addEventListener("click", () => {
      appState.routines = appState.routines.filter(r => r.id !== item.id);
      saveData("routines", appState.routines);
      renderRoutines();
    });

    container.appendChild(el);
  });
}

function renderReminders() {
  const container = document.getElementById("reminders-list");
  container.innerHTML = "";
  appState.reminders.sort((a, b) => a.epoch - b.epoch);
  appState.reminders.forEach(item => {
    const displayTime = new Date(item.time).toLocaleString();
    const el = document.createElement("div");
    el.className = "styled-item";
    el.innerHTML = `
      <div class="styled-item-desc">
        <span class="styled-item-title">${escapeHTML(item.text)}</span>
        <span class="styled-item-meta">⏰ ${displayTime}</span>
      </div>
      <button class="delete-btn" style="background:var(--danger-color); padding: 4px 8px; font-size: 0.75rem;">Clear</button>
    `;
    el.querySelector(".delete-btn").addEventListener("click", () => {
      appState.reminders = appState.reminders.filter(r => r.id !== item.id);
      saveData("reminders", appState.reminders);
      chrome.runtime.sendMessage({ action: "clear-alarm", id: item.id }, () => {
        renderReminders();
      });
    });
    container.appendChild(el);
  });
}

function startReminderCheckingDaemon() {
  setInterval(() => {
    const now = Date.now();
    const today = new Date();
    const todayStr = today.toDateString(); 
    const calendarKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

    // 1. Check Date-Time Reminders
    appState.reminders.forEach(item => {
      if (now >= item.epoch) {
        triggerScreenModalAlert(`Reminder Alert: "${item.text}"`);
        appState.reminders = appState.reminders.filter(r => r.id !== item.id);
        saveData("reminders", appState.reminders);
        renderReminders();
      }
    });

    // 2. Check Daily Routines
    appState.routines.forEach(item => {
      if (item.alertTime && !item.checked && item.lastAlertDate !== todayStr) {
        const [targetHour, targetMin] = item.alertTime.split(":");
        if (today.getHours() === parseInt(targetHour) && today.getMinutes() === parseInt(targetMin)) {
          triggerScreenModalAlert(`Daily Task Reminder: "${item.text}"`);
          item.lastAlertDate = todayStr; 
          saveData("routines", appState.routines);
        }
      }
    });

    // 3. Check Scheduled Calendar Day Events
    if (appState.calendarEvents[calendarKey] && appState.calendarEvents[calendarKey].length > 0) {
      const activeEvents = appState.calendarEvents[calendarKey];
      activeEvents.forEach(evt => {
        triggerScreenModalAlert(`Calendar Event Scheduled Today: "${evt}"`);
      });
      // Clear triggered events so they only fire once
      delete appState.calendarEvents[calendarKey];
      saveData("calendarEvents", appState.calendarEvents);
      renderCalendar();
    }

  }, 10000);
}

function triggerScreenModalAlert(message) {
  const modal = document.getElementById("on-screen-alert-modal");
  const modalBody = document.getElementById("alert-modal-content");
  modalBody.textContent = message;
  modal.classList.remove("hidden");

  try {
    const alertAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = alertAudioCtx.createOscillator();
    const gain = alertAudioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, alertAudioCtx.currentTime); 
    gain.gain.setValueAtTime(0.3, alertAudioCtx.currentTime);
    osc.connect(gain);
    gain.connect(alertAudioCtx.destination);
    osc.start();
    osc.stop(alertAudioCtx.currentTime + 0.35);
  } catch (audioErr) {
    console.warn("Failed to play pop-up tone", audioErr);
  }
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}