const STORAGE_KEY = "newtab.v2.state";
const LONG_PRESS_MS = 450;

const DEFAULT_SHORTCUTS = [
    { id: "gmail", name: "Gmail", url: "https://mail.google.com", icon: "M" },
    { id: "github", name: "GitHub", url: "https://github.com", icon: "G" },
    { id: "youtube", name: "YouTube", url: "https://youtube.com", icon: "Y" },
    { id: "calendar", name: "Calendar", url: "https://calendar.google.com", icon: "C" },
    { id: "notion", name: "Notion", url: "https://notion.so", icon: "N" }
];

const DEFAULT_STATE = {
    clock: {
        format: "24",
        showSeconds: false,
        color: "#ffffff",
        weight: 500,
        font: "default"
    },
    shortcuts: DEFAULT_SHORTCUTS
};

const state = {
    editing: false,
    draggingId: null,
    ...DEFAULT_STATE
};

const dom = {
    time: document.getElementById("time"),
    dateText: document.getElementById("dateText"),
    clockFormat: document.getElementById("clockFormat"),
    showSeconds: document.getElementById("showSeconds"),
    clockColor: document.getElementById("clockColor"),
    clockWeight: document.getElementById("clockWeight"),
    clockFont: document.getElementById("clockFont"),
    shortcutsRail: document.getElementById("shortcutsRail"),
    shortcutsGrid: document.getElementById("shortcutsGrid"),
    addShortcutBtn: document.getElementById("addShortcutBtn"),
    toggleEditBtn: document.getElementById("toggleEditBtn"),
    showAllBtn: document.getElementById("showAllBtn"),
    modal: document.getElementById("shortcutsModal"),
    closeModalBtn: document.getElementById("closeModalBtn")
};

const supportsChromeStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

async function loadState() {
    try {
        let raw;
        if (supportsChromeStorage) {
            raw = await new Promise((resolve) => {
                chrome.storage.local.get([STORAGE_KEY], (result) => resolve(result[STORAGE_KEY]));
            });
        } else {
            raw = localStorage.getItem(STORAGE_KEY);
            raw = raw ? JSON.parse(raw) : null;
        }

        if (!raw) {
            return;
        }

        state.clock = { ...DEFAULT_STATE.clock, ...raw.clock };
        state.shortcuts = Array.isArray(raw.shortcuts) && raw.shortcuts.length > 0 ? raw.shortcuts : DEFAULT_SHORTCUTS;
    } catch (error) {
        console.error("Impossible de charger l'etat", error);
    }
}

async function saveState() {
    const snapshot = {
        clock: state.clock,
        shortcuts: state.shortcuts
    };

    try {
        if (supportsChromeStorage) {
            await new Promise((resolve) => {
                chrome.storage.local.set({ [STORAGE_KEY]: snapshot }, resolve);
            });
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        }
    } catch (error) {
        console.error("Impossible de sauvegarder l'etat", error);
    }
}

function applyClockStyle() {
    document.documentElement.style.setProperty("--clock-color", state.clock.color);
    document.documentElement.style.setProperty("--clock-weight", String(state.clock.weight));

    dom.time.classList.remove("font-rounded", "font-serif");
    if (state.clock.font === "rounded") {
        dom.time.classList.add("font-rounded");
    }
    if (state.clock.font === "serif") {
        dom.time.classList.add("font-serif");
    }
}

function updateClock() {
    const now = new Date();
    const timeOptions = {
        hour: "2-digit",
        minute: "2-digit",
        hour12: state.clock.format === "12"
    };

    if (state.clock.showSeconds) {
        timeOptions.second = "2-digit";
    }

    const dateOptions = {
        weekday: "long",
        day: "numeric",
        month: "long"
    };

    dom.time.textContent = new Intl.DateTimeFormat("fr-FR", timeOptions).format(now);
    dom.dateText.textContent = new Intl.DateTimeFormat("fr-FR", dateOptions).format(now);
}

function syncClockControls() {
    dom.clockFormat.value = state.clock.format;
    dom.showSeconds.checked = state.clock.showSeconds;
    dom.clockColor.value = state.clock.color;
    dom.clockWeight.value = String(state.clock.weight);
    dom.clockFont.value = state.clock.font;
    applyClockStyle();
}

function createShortcutElement(shortcut) {
    const wrapper = document.createElement("div");
    wrapper.className = "shortcut-item";
    wrapper.dataset.id = shortcut.id;
    wrapper.draggable = state.editing;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", `Supprimer ${shortcut.name}`);
    deleteBtn.textContent = "-";
    deleteBtn.addEventListener("click", (event) => {
        event.preventDefault();
        removeShortcut(shortcut.id);
    });

    const link = document.createElement("a");
    link.className = "shortcut-link";
    link.href = shortcut.url;
    link.innerHTML = `
        <span class="shortcut-icon">${shortcut.icon}</span>
        <span class="shortcut-name">${shortcut.name}</span>
    `;

    if (state.editing) {
        link.addEventListener("click", (event) => event.preventDefault());
    }

    attachLongPress(wrapper);
    attachDragAndDrop(wrapper);

    wrapper.appendChild(deleteBtn);
    wrapper.appendChild(link);
    return wrapper;
}

function renderShortcuts() {
    dom.shortcutsRail.innerHTML = "";
    dom.shortcutsGrid.innerHTML = "";

    state.shortcuts.forEach((shortcut) => {
        dom.shortcutsRail.appendChild(createShortcutElement(shortcut));
        dom.shortcutsGrid.appendChild(createShortcutElement(shortcut));
    });

    const addCard = document.createElement("button");
    addCard.className = "shortcut-add";
    addCard.type = "button";
    addCard.innerHTML = '<span class="shortcut-icon">+</span><span class="shortcut-name">Ajouter</span>';
    addCard.addEventListener("click", promptAddShortcut);

    const holder = document.createElement("div");
    holder.className = "shortcut-item";
    holder.appendChild(addCard);
    dom.shortcutsRail.appendChild(holder);
}

function moveShortcut(fromId, toId) {
    if (!fromId || !toId || fromId === toId) {
        return;
    }

    const fromIndex = state.shortcuts.findIndex((item) => item.id === fromId);
    const toIndex = state.shortcuts.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0) {
        return;
    }

    const [item] = state.shortcuts.splice(fromIndex, 1);
    state.shortcuts.splice(toIndex, 0, item);
    renderShortcuts();
    saveState();
}

function attachDragAndDrop(element) {
    element.addEventListener("dragstart", (event) => {
        if (!state.editing) {
            event.preventDefault();
            return;
        }

        state.draggingId = element.dataset.id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", state.draggingId);
    });

    element.addEventListener("dragover", (event) => {
        if (!state.editing) {
            return;
        }
        event.preventDefault();
        element.classList.add("drag-over");
    });

    element.addEventListener("dragleave", () => {
        element.classList.remove("drag-over");
    });

    element.addEventListener("drop", (event) => {
        event.preventDefault();
        element.classList.remove("drag-over");
        const sourceId = state.draggingId || event.dataTransfer.getData("text/plain");
        moveShortcut(sourceId, element.dataset.id);
    });

    element.addEventListener("dragend", () => {
        state.draggingId = null;
        element.classList.remove("drag-over");
    });
}

function attachLongPress(element) {
    let timer = null;

    const clear = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    element.addEventListener("pointerdown", () => {
        if (state.editing) {
            return;
        }
        timer = setTimeout(() => setEditing(true), LONG_PRESS_MS);
    });

    ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
        element.addEventListener(eventName, clear);
    });
}

function setEditing(isEditing) {
    state.editing = isEditing;
    document.body.classList.toggle("editing", isEditing);
    dom.toggleEditBtn.textContent = isEditing ? "Terminer" : "Modifier";
    renderShortcuts();
}

function removeShortcut(id) {
    state.shortcuts = state.shortcuts.filter((item) => item.id !== id);
    renderShortcuts();
    saveState();
}

function normalizeUrl(url) {
    if (/^https?:\/\//i.test(url)) {
        return url;
    }
    return `https://${url}`;
}

function promptAddShortcut() {
    const name = window.prompt("Nom du raccourci :");
    if (!name) {
        return;
    }

    const rawUrl = window.prompt("URL (ex: github.com) :");
    if (!rawUrl) {
        return;
    }

    const iconValue = window.prompt("Lettre ou symbole (1-2 caracteres) :", name.charAt(0).toUpperCase()) ||
        name.charAt(0).toUpperCase();

    state.shortcuts.push({
        id: `${Date.now()}`,
        name: name.trim(),
        url: normalizeUrl(rawUrl.trim()),
        icon: iconValue.trim().slice(0, 2) || "*"
    });

    renderShortcuts();
    saveState();
}

function bindEvents() {
    dom.clockFormat.addEventListener("change", () => {
        state.clock.format = dom.clockFormat.value;
        updateClock();
        saveState();
    });

    dom.showSeconds.addEventListener("change", () => {
        state.clock.showSeconds = dom.showSeconds.checked;
        updateClock();
        saveState();
    });

    dom.clockColor.addEventListener("input", () => {
        state.clock.color = dom.clockColor.value;
        applyClockStyle();
        saveState();
    });

    dom.clockWeight.addEventListener("input", () => {
        state.clock.weight = Number(dom.clockWeight.value);
        applyClockStyle();
        saveState();
    });

    dom.clockFont.addEventListener("change", () => {
        state.clock.font = dom.clockFont.value;
        applyClockStyle();
        saveState();
    });

    dom.addShortcutBtn.addEventListener("click", promptAddShortcut);
    dom.toggleEditBtn.addEventListener("click", () => setEditing(!state.editing));

    dom.showAllBtn.addEventListener("click", () => {
        if (typeof dom.modal.showModal === "function") {
            dom.modal.showModal();
        }
    });

    dom.closeModalBtn.addEventListener("click", () => dom.modal.close());

    dom.modal.addEventListener("click", (event) => {
        const box = dom.modal.getBoundingClientRect();
        const clickedInside =
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom;
        if (!clickedInside) {
            dom.modal.close();
        }
    });

    enableRailDragScroll();
}

function enableRailDragScroll() {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    dom.shortcutsRail.addEventListener("pointerdown", (event) => {
        isDown = true;
        startX = event.clientX;
        scrollLeft = dom.shortcutsRail.scrollLeft;
        dom.shortcutsRail.setPointerCapture(event.pointerId);
    });

    dom.shortcutsRail.addEventListener("pointermove", (event) => {
        if (!isDown) {
            return;
        }
        const walk = event.clientX - startX;
        dom.shortcutsRail.scrollLeft = scrollLeft - walk;
    });

    const stop = () => {
        isDown = false;
    };

    dom.shortcutsRail.addEventListener("pointerup", stop);
    dom.shortcutsRail.addEventListener("pointercancel", stop);
    dom.shortcutsRail.addEventListener("pointerleave", stop);
}

async function init() {
    await loadState();
    syncClockControls();
    renderShortcuts();
    updateClock();
    bindEvents();
    setInterval(updateClock, 1000);
}

init();

