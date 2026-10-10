// Application State
let notes = [];
let routines = [];
let flashcards = [];
let reminders = [];
let currentCardIndex = 0;

// Initialize layout positioning sync with Content Script
const dockSelect = document.getElementById("dock-select");
dockSelect.addEventListener("change", (e) => {
  const position = e.target.value;
  window.parent.postMessage({ action: "change-dock", position: position }, "*");
  chrome.storage.local.set({ savedDockPosition: position });
});

// Restore saved dock position on startup
chrome.storage.local.get("savedDockPosition", (data) => {
  if (data.savedDockPosition) {
    dockSelect.value = data.savedDockPosition;
    window.parent.postMessage({ action: "change-dock", position: data.savedDockPosition }, "*");
  }
});

// Navigation / Tabs implementation
const tabs = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));
    
    tab.classList.add("active");
    const tabId = `tab-${tab.getAttribute("data-tab")}`;
    document.getElementById(tabId).classList.add("active");
  });
});

// Load persistent data from storage on initialization
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get({ notes: [], routines: [], flashcards: [], reminders: [] }, (data) => {
    notes = data.notes;
    routines = data.routines;
    flashcards = data.flashcards;
    reminders = data.reminders;
    
    renderNotes();
    renderRoutines();
    renderFlashcards();
    renderReminders();
  });
});

// ---- Notes logic (Notion-lite / Keep-lite) ----
const saveNoteBtn = document.getElementById("save-note-btn");
const noteTitle = document.getElementById("note-title");
const noteBody = document.getElementById("note-body");
const notesList = document.getElementById("notes-list");

saveNoteBtn.addEventListener("click", () => {
  const title = noteTitle.value.trim();
  const body = noteBody.value.trim();
  if (!title && !body) return;

  const newNote = {
    id: Date.now().toString(),
    title: title || "Untitled Note",
    body: body,
    date: new Date().toLocaleDateString()
  };

  notes.unshift(newNote);
  chrome.storage.local.set({ notes }, () => {
    renderNotes();
    noteTitle.value = "";
    noteBody.value = "";
  });
});

function renderNotes() {
  notesList.innerHTML = "";
  notes.forEach(note => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div class="list-item-content">
        <div class="list-item-title">${escapeHTML(note.title)}</div>
        <div class="list-item-sub" style="white-space: pre-wrap;">${escapeHTML(note.body)}</div>
        <div class="list-item-sub">${note.date}</div>
      </div>
      <button class="delete-btn" data-id="${note.id}">Remove</button>
    `;
    item.querySelector(".delete-btn").addEventListener("click", () => deleteNote(note.id));
    notesList.appendChild(item);
  });
}

function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  chrome.storage.local.set({ notes }, renderNotes);
}


// ---- Routines logic (Checklists) ----
const addRoutineBtn = document.getElementById("add-routine-btn");
const routineInput = document.getElementById("routine-input");
const routinesList = document.getElementById("routines-list");

addRoutineBtn.addEventListener("click", () => {
  const text = routineInput.value.trim();
  if (!text) return;

  const newRoutine = {
    id: Date.now().toString(),
    text,
    completed: false
  };

  routines.push(newRoutine);
  chrome.storage.local.set({ routines }, () => {
    renderRoutines();
    routineInput.value = "";
  });
});

function renderRoutines() {
  routinesList.innerHTML = "";
  routines.forEach(item => {
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" ${item.completed ? "checked" : ""} data-id="${item.id}">
        <span style="${item.completed ? "text-decoration: line-through; color: var(--text-muted);" : ""}">${escapeHTML(item.text)}</span>
      </div>
      <button class="delete-btn" data-id="${item.id}">Remove</button>
    `;
    
    el.querySelector("input[type='checkbox']").addEventListener("change", (e) => toggleRoutine(item.id, e.target.checked));
    el.querySelector(".delete-btn").addEventListener("click", () => deleteRoutine(item.id));
    routinesList.appendChild(el);
  });
}

function toggleRoutine(id, completed) {
  routines = routines.map(r => r.id === id ? { ...r, completed } : r);
  chrome.storage.local.set({ routines }, renderRoutines);
}

function deleteRoutine(id) {
  routines = routines.filter(r => r.id !== id);
  chrome.storage.local.set({ routines }, renderRoutines);
}


// ---- Flashcards & Quiz logic (Quizlet-lite) ----
const addCardBtn = document.getElementById("add-card-btn");
const flashFront = document.getElementById("flash-front");
const flashBack = document.getElementById("flash-back");
const cardsList = document.getElementById("cards-list");
const quizToggleBtn = document.getElementById("quiz-toggle-btn");
const flashcardViewer = document.getElementById("flashcard-viewer");
const cardControls = document.getElementById("card-controls");
const cardFront = document.getElementById("card-front");
const cardBack = document.getElementById("card-back");

addCardBtn.addEventListener("click", () => {
  const front = flashFront.value.trim();
  const back = flashBack.value.trim();
  if (!front || !back) return;

  const newCard = { id: Date.now().toString(), front, back };
  flashcards.push(newCard);
  chrome.storage.local.set({ flashcards }, () => {
    renderFlashcards();
    flashFront.value = "";
    flashBack.value = "";
  });
});

function renderFlashcards() {
  cardsList.innerHTML = "";
  flashcards.forEach(card => {
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div class="list-item-content">
        <div class="list-item-title">Q: ${escapeHTML(card.front)}</div>
        <div class="list-item-sub">A: ${escapeHTML(card.back)}</div>
      </div>
      <button class="delete-btn">Remove</button>
    `;
    el.querySelector(".delete-btn").addEventListener("click", () => deleteCard(card.id));
    cardsList.appendChild(el);
  });
}

function deleteCard(id) {
  flashcards = flashcards.filter(c => c.id !== id);
  chrome.storage.local.set({ flashcards }, () => {
    renderFlashcards();
    updateQuizView();
  });
}

// Flashcard viewer controls
quizToggleBtn.addEventListener("click", () => {
  flashcardViewer.classList.toggle("hidden");
  cardControls.classList.toggle("hidden");
  currentCardIndex = 0;
  updateQuizView();
});

function updateQuizView() {
  if (flashcards.length === 0) {
    cardFront.textContent = "No cards added yet.";
    cardBack.textContent = "No cards added yet.";
    return;
  }
  flashcardViewer.classList.remove("flipped");
  const card = flashcards[currentCardIndex];
  cardFront.textContent = card.front;
  cardBack.textContent = card.back;
}

flashcardViewer.addEventListener("click", () => {
  flashcardViewer.classList.toggle("flipped");
});

document.getElementById("flip-card-btn").addEventListener("click", () => {
  flashcardViewer.classList.toggle("flipped");
});

document.getElementById("next-card-btn").addEventListener("click", () => {
  if (flashcards.length > 0) {
    currentCardIndex = (currentCardIndex + 1) % flashcards.length;
    updateQuizView();
  }
});

document.getElementById("prev-card-btn").addEventListener("click", () => {
  if (flashcards.length > 0) {
    currentCardIndex = (currentCardIndex - 1 + flashcards.length) % flashcards.length;
    updateQuizView();
  }
});


// ---- Reminders logic ----
const addReminderBtn = document.getElementById("add-reminder-btn");
const remindText = document.getElementById("remind-text");
const remindTime = document.getElementById("remind-time");
const remindersList = document.getElementById("reminders-list");

addReminderBtn.addEventListener("click", () => {
  const text = remindText.value.trim();
  const timeVal = remindTime.value;
  if (!text || !timeVal) return;

  const reminderEpoch = new Date(timeVal).getTime();
  if (reminderEpoch <= Date.now()) {
    alert("Please select a date/time in the future.");
    return;
  }

  const id = "reminder_" + Date.now();
  const newReminder = { id, text, time: timeVal, epoch: reminderEpoch };

  reminders.push(newReminder);
  chrome.storage.local.set({ reminders }, () => {
    // Send background process a message to launch a Chrome Alarm
    chrome.runtime.sendMessage({
      action: "set-alarm",
      data: { id, title: "Sidekick Alert", time: reminderEpoch }
    }, () => {
      renderReminders();
      remindText.value = "";
      remindTime.value = "";
    });
  });
});

function renderReminders() {
  remindersList.innerHTML = "";
  // Sort reminders with soonest first
  reminders.sort((a, b) => a.epoch - b.epoch);
  
  reminders.forEach(item => {
    const readableTime = new Date(item.time).toLocaleString();
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div class="list-item-content">
        <div class="list-item-title">${escapeHTML(item.text)}</div>
        <div class="list-item-sub">${readableTime}</div>
      </div>
      <button class="delete-btn">Clear</button>
    `;
    el.querySelector(".delete-btn").addEventListener("click", () => deleteReminder(item.id));
    remindersList.appendChild(el);
  });
}

function deleteReminder(id) {
  reminders = reminders.filter(r => r.id !== id);
  chrome.storage.local.set({ reminders }, () => {
    chrome.runtime.sendMessage({ action: "clear-alarm", id }, () => {
      renderReminders();
    });
  });
}

// Utility to escape HTML and prevent potential injection vulnerabilities
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}