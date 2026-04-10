const STORAGE_KEY = "newtab.v2.state";
const LONG_PRESS_MS = 450;
const CLOCK_LONG_PRESS_MS = 500;

const DEFAULT_SHORTCUTS = [
    { id: "github", name: "GitHub - .Hugo", url: "https://github.com/HugoALVES7", icon: "G" }
];

const DEFAULT_STATE = {
    clock: {
        format: "24",
        color: "#ffffff",
        weight: 500,
        font: "default",
        iconsMonochrome: false
    },
    shortcuts: DEFAULT_SHORTCUTS
};

const state = {
    editing: false,
    draggingId: null,
    clockSettingsOpen: false,
    deleteTargetId: "",
    ...DEFAULT_STATE
};

const dom = {
    time: document.getElementById("time"),
    clockSection: document.querySelector(".clock-section"),
    clockSettings: document.getElementById("clockSettings"),
    dateText: document.getElementById("dateText"),
    clockColor: document.getElementById("clockColor"),
    clockWeight: document.getElementById("clockWeight"),
    clockFont: document.getElementById("clockFont"),
    shortcutIconsMonochrome: document.getElementById("shortcutIconsMonochrome"),
    shortcutsRail: document.getElementById("shortcutsRail"),
    shortcutsGrid: document.getElementById("shortcutsGrid"),
    shortcutsSearchInput: document.getElementById("shortcutsSearchInput"),
    showAllBtn: null,
    modal: document.getElementById("shortcutsModal"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    shortcutEditorModal: document.getElementById("shortcutEditorModal"),
    shortcutForm: document.getElementById("shortcutForm"),
    shortcutFormTitle: document.getElementById("shortcutFormTitle"),
    shortcutId: document.getElementById("shortcutId"),
    shortcutName: document.getElementById("shortcutName"),
    shortcutUrl: document.getElementById("shortcutUrl"),
    shortcutImageUrl: document.getElementById("shortcutImageUrl"),
    shortcutCancelBtn: document.getElementById("shortcutCancelBtn"),
    shortcutDeleteModal: document.getElementById("shortcutDeleteModal"),
    deleteShortcutName: document.getElementById("deleteShortcutName"),
    deleteCancelBtn: document.getElementById("deleteCancelBtn"),
    deleteConfirmBtn: document.getElementById("deleteConfirmBtn")
};

dom.showAllBtn = document.createElement("button");
dom.showAllBtn.id = "showAllBtn";
dom.showAllBtn.className = "zoom-btn";
dom.showAllBtn.type = "button";
dom.showAllBtn.setAttribute("aria-label", "Tout afficher");
dom.showAllBtn.innerHTML = `
    <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M7 3H3v4M13 3h4v4M3 13v4h4M17 13v4h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
`;

async function loadState() {
    try {
        let raw;
        raw = localStorage.getItem(STORAGE_KEY);
        raw = raw ? JSON.parse(raw) : null;

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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
        console.error("Impossible de sauvegarder l'etat", error);
    }
}

function applyClockStyle() {
    document.documentElement.style.setProperty("--clock-color", state.clock.color);
    document.documentElement.style.setProperty("--clock-weight", String(state.clock.weight));
    document.body.classList.toggle("icons-monochrome", Boolean(state.clock.iconsMonochrome));

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
        hour12: false
    };

    const dateOptions = {
        weekday: "long",
        day: "numeric",
        month: "long"
    };

    dom.time.textContent = new Intl.DateTimeFormat("fr-FR", timeOptions).format(now);
    dom.dateText.textContent = new Intl.DateTimeFormat("fr-FR", dateOptions).format(now);
}

function syncClockControls() {
    dom.clockColor.value = state.clock.color;
    dom.clockWeight.value = String(state.clock.weight);
    dom.clockFont.value = state.clock.font;
    dom.shortcutIconsMonochrome.checked = Boolean(state.clock.iconsMonochrome);
    applyClockStyle();
}

function setClockSettingsOpen(isOpen) {
    state.clockSettingsOpen = isOpen;
    dom.clockSettings.hidden = !isOpen;
    dom.clockSettings.classList.toggle("open", isOpen);
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
    deleteBtn.textContent = "−";
    deleteBtn.addEventListener("click", (event) => {
        event.preventDefault();
        openDeleteDialog(shortcut.id, shortcut.name);
    });

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.type = "button";
    editBtn.setAttribute("aria-label", `Modifier ${shortcut.name}`);
    editBtn.textContent = "...";
    editBtn.addEventListener("click", (event) => {
        event.preventDefault();
        openShortcutDialog("edit", shortcut.id);
    });

    const link = document.createElement("a");
    link.className = "shortcut-link";
    link.href = shortcut.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const iconSpan = document.createElement("span");
    iconSpan.className = "shortcut-icon";
    loadShortcutIcon(iconSpan, shortcut);

    const nameSpan = document.createElement("span");
    nameSpan.className = "shortcut-name";
    nameSpan.textContent = shortcut.name;

    link.appendChild(iconSpan);
    link.appendChild(nameSpan);

    // Empêcher le lien de se suivre en mode édition
    link.addEventListener("click", (event) => {
        if (state.editing) {
            event.preventDefault();
        }
    });

    attachLongPress(wrapper);
    attachDragAndDrop(wrapper);

    wrapper.appendChild(deleteBtn);
    wrapper.appendChild(editBtn);
    wrapper.appendChild(link);
    return wrapper;
}

function buildFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (error) {
        return "";
    }
}

function applyImageIcon(iconElement, imageUrl) {
    const safeUrl = imageUrl.replace(/'/g, "%27");
    iconElement.style.backgroundImage = `url('${safeUrl}')`;
    iconElement.style.backgroundSize = "cover";
    iconElement.style.backgroundRepeat = "no-repeat";
    iconElement.style.backgroundPosition = "center";
    iconElement.classList.add("has-image");
    iconElement.textContent = "";
}

function applyTextIcon(iconElement, text) {
    iconElement.style.backgroundImage = "";
    iconElement.classList.remove("has-image");
    iconElement.textContent = text;
}

function loadShortcutIcon(iconElement, shortcut) {
    const fallbackText = (shortcut.icon || shortcut.name.charAt(0).toUpperCase() || "*").slice(0, 2);
    const faviconUrl = buildFaviconUrl(shortcut.url);
    applyTextIcon(iconElement, fallbackText);

    const tryFavicon = () => {
        if (!faviconUrl) {
            return;
        }
        const faviconImage = new Image();
        faviconImage.onload = () => applyImageIcon(iconElement, faviconUrl);
        faviconImage.onerror = () => applyTextIcon(iconElement, fallbackText);
        faviconImage.src = faviconUrl;
    };

    if (shortcut.customIconUrl) {
        const customImage = new Image();
        customImage.onload = () => applyImageIcon(iconElement, shortcut.customIconUrl);
        customImage.onerror = tryFavicon;
        customImage.src = shortcut.customIconUrl;
    } else {
        tryFavicon();
    }
}

function normalizeSearchText(value) {
    return (value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function getFilteredShortcuts() {
    const query = normalizeSearchText(dom.shortcutsSearchInput ? dom.shortcutsSearchInput.value : "").trim();
    if (!query) {
        return state.shortcuts;
    }
    return state.shortcuts.filter((shortcut) => normalizeSearchText(shortcut.name).includes(query));
}

function renderShortcutsRail() {
    dom.shortcutsRail.innerHTML = "";

    state.shortcuts.forEach((shortcut) => {
        dom.shortcutsRail.appendChild(createShortcutElement(shortcut));
    });

    const addCard = document.createElement("button");
    addCard.className = "shortcut-add";
    addCard.type = "button";
    addCard.innerHTML = '<span class="shortcut-icon">+</span><span class="shortcut-name">Ajouter</span>';
    addCard.addEventListener("click", () => openShortcutDialog("add"));

    const holder = document.createElement("div");
    holder.className = "shortcut-item";
    holder.appendChild(addCard);
    dom.shortcutsRail.appendChild(holder);

    const showAllHolder = document.createElement("div");
    showAllHolder.className = "shortcut-item";
    showAllHolder.appendChild(dom.showAllBtn);
    dom.shortcutsRail.appendChild(showAllHolder);
}

function renderShortcutsGrid() {
    dom.shortcutsGrid.innerHTML = "";
    const filteredShortcuts = getFilteredShortcuts();

    filteredShortcuts.forEach((shortcut) => {
        dom.shortcutsGrid.appendChild(createShortcutElement(shortcut));
    });

    if (filteredShortcuts.length === 0) {
        const empty = document.createElement("p");
        empty.className = "shortcuts-empty";
        empty.textContent = "Aucun raccourci trouve";
        dom.shortcutsGrid.appendChild(empty);
    }
}

function renderShortcuts() {
    renderShortcutsRail();
    renderShortcutsGrid();
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
    renderShortcuts();
}

function removeShortcut(id) {
    state.shortcuts = state.shortcuts.filter((item) => item.id !== id);
    renderShortcuts();
    saveState();
}

function openDeleteDialog(id, name) {
    state.deleteTargetId = id;
    dom.deleteShortcutName.textContent = name;
    if (typeof dom.shortcutDeleteModal.showModal === "function") {
        dom.shortcutDeleteModal.showModal();
    }
}

function closeDeleteDialog() {
    state.deleteTargetId = "";
    dom.shortcutDeleteModal.close();
}

function confirmDeleteShortcut() {
    if (!state.deleteTargetId) {
        closeDeleteDialog();
        return;
    }
    removeShortcut(state.deleteTargetId);
    closeDeleteDialog();
}

function normalizeUrl(url) {
    if (/^https?:\/\//i.test(url)) {
        return url;
    }
    return `https://${url}`;
}

function normalizeImageUrl(url) {
    if (!url) {
        return "";
    }
    if (/^https?:\/\//i.test(url) || /^data:image\//i.test(url)) {
        return url;
    }
    return `https://${url}`;
}

function openShortcutDialog(mode, shortcutId = "") {
    if (state.editing) {
        setEditing(false);
    }

    if (mode === "edit") {
        const shortcut = state.shortcuts.find((item) => item.id === shortcutId);
        if (!shortcut) {
            return;
        }

        dom.shortcutFormTitle.textContent = "Modifier le raccourci";
        dom.shortcutId.value = shortcut.id;
        dom.shortcutName.value = shortcut.name;
        dom.shortcutUrl.value = shortcut.url;
        dom.shortcutImageUrl.value = shortcut.customIconUrl || "";
    } else {
        dom.shortcutFormTitle.textContent = "Ajouter un raccourci";
        dom.shortcutId.value = "";
        dom.shortcutName.value = "";
        dom.shortcutUrl.value = "";
        dom.shortcutImageUrl.value = "";
    }

    if (typeof dom.shortcutEditorModal.showModal === "function") {
        dom.shortcutEditorModal.showModal();
    }
    dom.shortcutName.focus();
}

function closeShortcutDialog() {
    dom.shortcutEditorModal.close();
    dom.shortcutForm.reset();
}

function submitShortcutForm(event) {
    event.preventDefault();

    const id = dom.shortcutId.value;
    const name = dom.shortcutName.value.trim();
    const rawUrl = dom.shortcutUrl.value.trim();
    const icon = name.charAt(0).toUpperCase() || "*";
    const customIconUrl = normalizeImageUrl(dom.shortcutImageUrl.value.trim());

    if (!name || !rawUrl) {
        return;
    }

    const normalizedUrl = normalizeUrl(rawUrl);

    if (id) {
        const shortcut = state.shortcuts.find((item) => item.id === id);
        if (!shortcut) {
            return;
        }
        shortcut.name = name;
        shortcut.url = normalizedUrl;
        shortcut.icon = icon;
        shortcut.customIconUrl = customIconUrl;
    } else {
        state.shortcuts.push({
            id: `${Date.now()}`,
            name,
            url: normalizedUrl,
            icon,
            customIconUrl
        });
    }

    closeShortcutDialog();
    renderShortcuts();
    saveState();
}

function bindEvents() {
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

    dom.shortcutIconsMonochrome.addEventListener("change", () => {
        state.clock.iconsMonochrome = dom.shortcutIconsMonochrome.checked;
        applyClockStyle();
        saveState();
    });

    dom.showAllBtn.addEventListener("click", () => {
        if (typeof dom.modal.showModal === "function") {
            dom.modal.showModal();
        }
        renderShortcutsGrid();
        if (dom.shortcutsSearchInput) {
            dom.shortcutsSearchInput.focus();
        }
    });

    dom.shortcutsSearchInput.addEventListener("input", renderShortcutsGrid);

    dom.shortcutForm.addEventListener("submit", submitShortcutForm);
    dom.shortcutCancelBtn.addEventListener("click", closeShortcutDialog);

    dom.shortcutEditorModal.addEventListener("click", (event) => {
        const box = dom.shortcutEditorModal.getBoundingClientRect();
        const clickedInside =
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom;
        if (!clickedInside) {
            closeShortcutDialog();
        }
    });

    dom.closeModalBtn.addEventListener("click", () => dom.modal.close());

    dom.deleteCancelBtn.addEventListener("click", closeDeleteDialog);
    dom.deleteConfirmBtn.addEventListener("click", confirmDeleteShortcut);

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

    dom.shortcutDeleteModal.addEventListener("click", (event) => {
        const box = dom.shortcutDeleteModal.getBoundingClientRect();
        const clickedInside =
            event.clientX >= box.left &&
            event.clientX <= box.right &&
            event.clientY >= box.top &&
            event.clientY <= box.bottom;
        if (!clickedInside) {
            closeDeleteDialog();
        }
    });

    attachClockLongPress();

    document.addEventListener("pointerdown", (event) => {
        // Fermer horloge si clic en dehors
        if (!state.clockSettingsOpen) {
            return;
        }
        if (dom.clockSection.contains(event.target)) {
            return;
        }
        setClockSettingsOpen(false);
    });

    // Quitter le mode édition si clic en dehors des raccourcis
    document.addEventListener("pointerdown", (event) => {
        if (!state.editing) {
            return;
        }
        // Si le clic est sur la section shortcuts, ne pas quitter
        if (document.querySelector(".shortcuts-section").contains(event.target)) {
            return;
        }
        setEditing(false);
    });

    enableRailDragScroll();
}

function attachClockLongPress() {
    let timer = null;
    let startedOnClock = false;

    const clear = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        startedOnClock = false;
    };

    dom.time.addEventListener("pointerdown", () => {
        startedOnClock = true;
        timer = setTimeout(() => {
            if (!startedOnClock) {
                return;
            }
            setClockSettingsOpen(!state.clockSettingsOpen);
        }, CLOCK_LONG_PRESS_MS);
    });

    ["pointerup", "pointerleave", "pointercancel"].forEach((eventName) => {
        dom.time.addEventListener(eventName, clear);
    });
}

function enableRailDragScroll() {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    dom.shortcutsRail.addEventListener("pointerdown", (event) => {
        // Ne pas capturer si c'est un bouton ou un lien
        if (event.target.closest("button, a")) {
            return;
        }
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
    setClockSettingsOpen(false);
    renderShortcuts();
    updateClock();
    bindEvents();
    setInterval(updateClock, 1000);
}

init();

