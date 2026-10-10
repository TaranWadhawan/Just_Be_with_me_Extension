// Global App Store & State Variables
let appState = {
  onenotePages: [],
  activePageId: null,
  keepNotes: [],
  docsContent: "",
  flashcardDecks: [], // Decks format: { id, title, cards: [ { id, front, back } ] }
  activeDeckId: null,
  routines: [],
  reminders: []
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
});

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
    reminders: []
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
    li.textContent = p.title;
    li.addEventListener("click", () => {
      appState.activePageId = p.id;
      saveData("activePageId", p.id);
      document.querySelectorAll(".sidebar-item").forEach(item => item.classList.remove("active"));
      li.classList.add("active");
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
  if (el) el.textContent = title;
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
    });
  });

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

// ---- FLASHCARDS STUDY ENGINE ----
let currentCardIndex = 0;

function setupFlashcardStudyEngine() {
  const addDeckBtn = document.getElementById("add-deck-btn");
  const deckInput = document.getElementById("deck-name-input");
  const dropdown = document.getElementById("deck-select-dropdown");
  
  const addCardBtn = document.getElementById("add-card-btn");
  const cardFrontInput = document.getElementById("card-front-input");
  const cardBackInput = document.getElementById("card-back-input");

  // Deck Creation
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

  // Dropdown Switch Listener
  dropdown.addEventListener("change", (e) => {
    appState.activeDeckId = e.target.value;
    saveData("activeDeckId", appState.activeDeckId);
    currentCardIndex = 0;
    renderActiveFlashcard();
  });

  // Card Creation
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

  // 3D Study viewer controller handlers
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

// ---- CANVAS SKETCHING ----
let canvas, ctx, drawing = false, canvasTool = "draw";

function setupCanvas() {
  canvas = document.getElementById("rough-board");
  ctx = canvas.getContext("2d");

  chrome.storage.local.get("canvasDataURL", (res) => {
    if (res.canvasDataURL) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
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
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(canvas, 0, 0);

  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  ctx.drawImage(tempCanvas, 0, 0);
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
  chrome.storage.local.set({ canvasDataURL: canvas.toDataURL() });
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

// ---- WORKSPACE TOOLS (WEB CLIPPER, POMODORO & AMBIENT SYNTHESIZER) ----
let pomoInterval = null;
let pomoSeconds = 1500; // 25 minutes standard
let pomoIsRunning = false;

let audioCtx = null;
let whiteNoiseSource = null;
let noiseGainNode = null;

function setupWorkspaceTools() {
  // A. Notion-Style Web Clipper
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
      
      // Inject citation into active Docs content
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
      
      // Script execution to extract the active tab's highlighted text selection
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

        // Add dynamically as a Google Keep card
        const keepNote = { id: Date.now().toString(), title: "Clipped Snippet", text: noteText, color: "blue" };
        appState.keepNotes.unshift(keepNote);
        saveData("keepNotes", appState.keepNotes);
        renderKeepNotes();
        alert("Text highlight clipped to Google Keep notes!");
      });
    });
  });

  // B. Pomodoro Timer
  const startBtn = document.getElementById("pomo-start-btn");
  const pauseBtn = document.getElementById("pomo-pause-btn");
  const resetBtn = document.getElementById("pomo-reset-btn");
  const timerDisplay = document.getElementById("pomo-clock");

  const renderTimer = () => {
    const mins = Math.floor(pomoSeconds / 60).toString().padStart(2, "0");
    const secs = (pomoSeconds % 60).toString().padStart(2, "0");
    timerDisplay.textContent = `${mins}:${secs}`;
  };

  startBtn.addEventListener("click", () => {
    if (pomoIsRunning) return;
    pomoIsRunning = true;
    pomoInterval = setInterval(() => {
      if (pomoSeconds > 0) {
        pomoSeconds--;
        renderTimer();
      } else {
        clearInterval(pomoInterval);
        pomoIsRunning = false;
        alert("Time is up! Let's take a break.");
        pomoSeconds = 1500;
        renderTimer();
      }
    }, 1000);
  });

  pauseBtn.addEventListener("click", () => {
    clearInterval(pomoInterval);
    pomoIsRunning = false;
  });

  resetBtn.addEventListener("click", () => {
    clearInterval(pomoInterval);
    pomoIsRunning = false;
    pomoSeconds = 1500;
    renderTimer();
  });

  // C. Ambient sound Synthesizer using local browser Audio API
  const soundBtn = document.getElementById("noise-toggle-btn");
  const volumeSlider = document.getElementById("noise-volume");

  soundBtn.addEventListener("click", () => {
    if (whiteNoiseSource) {
      // If noise is playing, stop it
      whiteNoiseSource.stop();
      whiteNoiseSource = null;
      soundBtn.textContent = "Play White Noise";
    } else {
      // Start generating noise
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const bufferSize = 2 * audioCtx.sampleRate;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      
      // Generate randomized sound buffer values
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      whiteNoiseSource = audioCtx.createBufferSource();
      whiteNoiseSource.buffer = noiseBuffer;
      whiteNoiseSource.loop = true;

      noiseGainNode = audioCtx.createGain();
      noiseGainNode.gain.value = volumeSlider.value;

      whiteNoiseSource.connect(noiseGainNode);
      noiseGainNode.connect(audioCtx.destination);

      whiteNoiseSource.start();
      soundBtn.textContent = "Mute Ambient Noise";
    }
  });

  volumeSlider.addEventListener("input", (e) => {
    if (noiseGainNode) {
      noiseGainNode.gain.setValueAtTime(e.target.value, audioCtx.currentTime);
    }
  });
}

// ---- REMINDERS & ALERTS ----
function setupRemindersAndRoutines() {
  document.getElementById("add-routine-btn").addEventListener("click", () => {
    const val = document.getElementById("routine-input").value.trim();
    if (!val) return;
    appState.routines.push({ id: Date.now().toString(), text: val, checked: false });
    saveData("routines", appState.routines);
    renderRoutines();
    document.getElementById("routine-input").value = "";
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
}

function renderRoutines() {
  const container = document.getElementById("routines-list");
  container.innerHTML = "";

  appState.routines.forEach(item => {
    const el = document.createElement("div");
    el.className = "styled-item";
    el.innerHTML = `
      <div style="display:flex; align-items:center;">
        <input type="checkbox" class="item-check" ${item.checked ? "checked" : ""}>
        <span style="${item.checked ? "text-decoration: line-through; opacity:0.6;" : ""}">${escapeHTML(item.text)}</span>
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

// Security Escape utility
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}