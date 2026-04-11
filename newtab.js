const STORAGE_KEY = "newtab.v2.state";
const LONG_PRESS_MS = 450;
const CLOCK_LONG_PRESS_MS = 500;

const SCHEMA_VERSION = 3;
const PINNED_LIST_ID = "pinned";

const DEFAULT_SHORTCUTS = [
    { id: "github", name: "GitHub - .Hugo", url: "https://github.com/HugoALVES7", icon: "G" }
];

const DEFAULT_STATE = {
    schemaVersion: SCHEMA_VERSION,
    clock: {
        format: "24",
        color: "#ffffff",
        weight: 500,
        font: "default",
        iconsMonochrome: false,
        showShortcutNames: true
    },
    // Nouveau schéma: raccourcis (sources) + entrées (copies) + listes
    shortcutsById: {},
    entriesById: {},
    lists: [
        { id: PINNED_LIST_ID, name: "Tous les raccourcis", locked: true, createdAt: Date.now() }
    ],
    listEntryIds: {
        [PINNED_LIST_ID]: []
    }
};

const state = {
    editing: false,
    dragging: null,
    clockSettingsOpen: false,
    deleteTargetId: "",
    deleteTargetEntryId: "",
    deleteTargetShortcutId: "",
    editingEntryId: "",
    ...DEFAULT_STATE
};

// Style icônes (iOS-like) activé par défaut
document.body.classList.add("ios-icons");

const dom = {
    time: document.getElementById("time"),
    clockSection: document.querySelector(".clock-section"),
    clockSettings: document.getElementById("clockSettings"),
    dateText: document.getElementById("dateText"),
    clockColor: document.getElementById("clockColor"),
    clockWeight: document.getElementById("clockWeight"),
    clockFont: document.getElementById("clockFont"),
    shortcutIconsMonochrome: document.getElementById("shortcutIconsMonochrome"),
    showShortcutNames: document.getElementById("showShortcutNames"),
    listsContainer: document.getElementById("listsContainer"),
    addListBtn: document.getElementById("addListBtn"),
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
        let raw = localStorage.getItem(STORAGE_KEY);
        raw = raw ? JSON.parse(raw) : null;

        if (!raw) {
            // init defaults
            hydrateDefaults();
            return;
        }

        // clock
        state.clock = { ...DEFAULT_STATE.clock, ...raw.clock };

        // Migration v2 -> v3
        // v2: { clock, shortcuts: [] }
        // v3: { schemaVersion:3, shortcutsById, entriesById, lists, listEntryIds }
        if (!raw.schemaVersion || raw.schemaVersion < SCHEMA_VERSION) {
            migrateFromV2(raw);
            await saveState();
            return;
        }

        // v3 load
        state.schemaVersion = raw.schemaVersion;
        state.shortcutsById = raw.shortcutsById && typeof raw.shortcutsById === "object" ? raw.shortcutsById : {};
        state.entriesById = raw.entriesById && typeof raw.entriesById === "object" ? raw.entriesById : {};
        state.lists = Array.isArray(raw.lists) && raw.lists.length ? raw.lists : DEFAULT_STATE.lists;
        state.listEntryIds = raw.listEntryIds && typeof raw.listEntryIds === "object" ? raw.listEntryIds : {
            [PINNED_LIST_ID]: []
        };

        ensureListInvariants();
    } catch (error) {
        console.error("Impossible de charger l'etat", error);
        hydrateDefaults();
    }
}

function hydrateDefaults() {
    state.schemaVersion = SCHEMA_VERSION;
    state.shortcutsById = {};
    state.entriesById = {};
    state.lists = JSON.parse(JSON.stringify(DEFAULT_STATE.lists));
    state.listEntryIds = {
        [PINNED_LIST_ID]: []
    };

    // Mettre les DEFAULT_SHORTCUTS dans Épinglés pour coller à l'UI existante
    DEFAULT_SHORTCUTS.forEach((sc) => {
        const shortcutId = sc.id;
        state.shortcutsById[shortcutId] = {
            id: shortcutId,
            name: sc.name,
            url: sc.url,
            icon: sc.icon,
            customIconUrl: sc.customIconUrl || "",
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        const entryId = createId("e");
        state.entriesById[entryId] = { id: entryId, shortcutId, addedAt: Date.now() };
        state.listEntryIds[PINNED_LIST_ID].push(entryId);
    });
}

function migrateFromV2(raw) {
    try {
        // Backup pour rollback manuel
        localStorage.setItem("newtab.v2.state.backup", JSON.stringify(raw));
    } catch {
        // ignore
    }

    hydrateDefaults();

    const shortcuts = Array.isArray(raw.shortcuts) ? raw.shortcuts : [];
    // Migration: tout ce qui existait dans la "rail" (Épinglés) -> liste Épinglés
    state.listEntryIds[PINNED_LIST_ID] = [];
    shortcuts.forEach((sc) => {
        const shortcutId = String(sc.id || createId("s"));
        state.shortcutsById[shortcutId] = {
            id: shortcutId,
            name: String(sc.name || "Raccourci").slice(0, 30),
            url: String(sc.url || ""),
            icon: sc.icon || (String(sc.name || "*").charAt(0).toUpperCase() || "*"),
            customIconUrl: sc.customIconUrl || "",
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        const entryId = createId("e");
        state.entriesById[entryId] = { id: entryId, shortcutId, addedAt: Date.now() };
        state.listEntryIds[PINNED_LIST_ID].push(entryId);
    });

    state.schemaVersion = SCHEMA_VERSION;
    ensureListInvariants();
}

async function saveState() {
    const snapshot = {
        schemaVersion: SCHEMA_VERSION,
        clock: state.clock,
        shortcutsById: state.shortcutsById,
        entriesById: state.entriesById,
        lists: state.lists,
        listEntryIds: state.listEntryIds
    };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
        console.error("Impossible de sauvegarder l'etat", error);
    }
}

function ensureListInvariants() {
    // pinned list must exist
    if (!Array.isArray(state.lists)) {
        state.lists = [];
    }

    const hasPinned = state.lists.some((l) => l && l.id === PINNED_LIST_ID);
    if (!hasPinned) {
        state.lists.unshift({ id: PINNED_LIST_ID, name: "Tous les raccourcis", locked: true, createdAt: Date.now() });
    }

    // Forcer le nom de la liste globale (pinned)
    const pinned = getListById(PINNED_LIST_ID);
    if (pinned) {
        pinned.name = "Tous les raccourcis";
        pinned.locked = true;
    }


    if (!state.listEntryIds || typeof state.listEntryIds !== "object") {
        state.listEntryIds = {};
    }
    state.lists.forEach((list) => {
        if (!state.listEntryIds[list.id]) {
            state.listEntryIds[list.id] = [];
        }
    });

    if (!state.shortcutsById || typeof state.shortcutsById !== "object") {
        state.shortcutsById = {};
    }
    if (!state.entriesById || typeof state.entriesById !== "object") {
        state.entriesById = {};
    }

    // Nettoyage: retirer les entryIds orphelins des listes
    for (const listId of Object.keys(state.listEntryIds)) {
        state.listEntryIds[listId] = (state.listEntryIds[listId] || []).filter((entryId) => state.entriesById[entryId]);
    }
}

function createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getListById(listId) {
    return state.lists.find((l) => l.id === listId) || null;
}

function getEntryListId(entryId) {
    for (const listId of Object.keys(state.listEntryIds)) {
        if ((state.listEntryIds[listId] || []).includes(entryId)) {
            return listId;
        }
    }
    return "";
}

function getShortcutForEntry(entry) {
    if (!entry) {
        return null;
    }
    return state.shortcutsById[entry.shortcutId] || null;
}

function applyClockStyle() {
    document.documentElement.style.setProperty("--clock-color", state.clock.color);
    document.documentElement.style.setProperty("--clock-weight", String(state.clock.weight));
    document.body.classList.toggle("icons-monochrome", Boolean(state.clock.iconsMonochrome));
    document.body.classList.toggle("hide-shortcut-names", state.clock.showShortcutNames === false);

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
    if (dom.showShortcutNames) {
        dom.showShortcutNames.checked = state.clock.showShortcutNames !== false;
    }
    applyClockStyle();
}

function setClockSettingsOpen(isOpen) {
    state.clockSettingsOpen = isOpen;
    dom.clockSettings.hidden = !isOpen;
    dom.clockSettings.classList.toggle("open", isOpen);
}

function createEntryElement(entryId, listId) {
    const entry = state.entriesById[entryId];
    const shortcut = getShortcutForEntry(entry);
    if (!entry || !shortcut) {
        const empty = document.createElement("div");
        empty.className = "shortcut-item";
        return empty;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "shortcut-item";
    wrapper.dataset.entryId = entryId;
    wrapper.dataset.listId = listId;
    wrapper.draggable = state.editing;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.type = "button";
    deleteBtn.setAttribute("aria-label", `Supprimer ${shortcut.name}`);
    deleteBtn.textContent = "−";
    deleteBtn.addEventListener("click", (event) => {
        event.preventDefault();
        openDeleteDialog(entryId, shortcut.id, shortcut.name);
    });

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.type = "button";
    editBtn.setAttribute("aria-label", `Modifier ${shortcut.name}`);
    editBtn.textContent = "...";
    editBtn.addEventListener("click", (event) => {
        event.preventDefault();
        openShortcutDialog("edit", entryId);
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
        return Object.values(state.shortcutsById);
    }
    return Object.values(state.shortcutsById).filter((shortcut) => normalizeSearchText(shortcut.name).includes(query));
}

function renderLists() {
    dom.listsContainer.innerHTML = "";

    // Épinglés doit être TOUJOURS en dernier
    const orderedLists = [
        ...state.lists.filter((l) => l.id !== PINNED_LIST_ID),
        getListById(PINNED_LIST_ID)
    ].filter(Boolean);

    orderedLists.forEach((list) => dom.listsContainer.appendChild(renderSingleList(list)));
}

function reorderList(fromListId, toListId) {
    if (!fromListId || !toListId || fromListId === toListId) {
        return;
    }
    if (fromListId === PINNED_LIST_ID || toListId === PINNED_LIST_ID) {
        // Épinglés est verrouillé en dernière position
        return;
    }

    const listsNoPinned = state.lists.filter((l) => l.id !== PINNED_LIST_ID);
    const fromIndex = listsNoPinned.findIndex((l) => l.id === fromListId);
    const toIndex = listsNoPinned.findIndex((l) => l.id === toListId);
    if (fromIndex < 0 || toIndex < 0) {
        return;
    }

    const [moved] = listsNoPinned.splice(fromIndex, 1);
    listsNoPinned.splice(toIndex, 0, moved);

    // Reconstruire state.lists en gardant Épinglés à la fin
    const pinned = getListById(PINNED_LIST_ID);
    state.lists = pinned ? [...listsNoPinned, pinned] : listsNoPinned;
    renderShortcuts();
    saveState();
}

function renderSingleList(list) {
    const listEl = document.createElement("section");
    listEl.className = "shortcut-list";
    listEl.dataset.listId = list.id;

    const header = document.createElement("div");
    header.className = "shortcut-list-header";

    // Drag & drop réordonnancement des listes (mode édition)
    if (state.editing && !list.locked && list.id !== PINNED_LIST_ID) {
        header.draggable = true;
        header.dataset.listId = list.id;

        header.addEventListener("dragstart", (event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", list.id);
            header.classList.add("dragging");
        });

        header.addEventListener("dragend", () => {
            header.classList.remove("dragging");
        });

        header.addEventListener("dragover", (event) => {
            event.preventDefault();
            header.classList.add("drag-over");
        });

        header.addEventListener("dragleave", () => header.classList.remove("drag-over"));

        header.addEventListener("drop", (event) => {
            event.preventDefault();
            header.classList.remove("drag-over");
            const fromListId = event.dataTransfer.getData("text/plain");
            reorderList(fromListId, list.id);
        });
    }

    const title = document.createElement("div");
    title.className = "shortcut-list-title";
    title.textContent = list.name;
    title.setAttribute("role", "heading");
    title.setAttribute("aria-level", "3");

    if (state.editing && !list.locked) {
        title.contentEditable = "true";
        title.spellcheck = false;
        title.addEventListener("blur", () => {
            const next = title.textContent.trim() || "Liste";
            renameList(list.id, next);
        });
        title.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                title.blur();
            }
        });
    }

    const actions = document.createElement("div");
    actions.className = "shortcut-list-actions";

    const listShowAllBtn = document.createElement("button");
    listShowAllBtn.className = "zoom-btn";
    listShowAllBtn.type = "button";
    listShowAllBtn.setAttribute("aria-label", `Tout afficher (${list.name})`);
    listShowAllBtn.innerHTML = dom.showAllBtn.innerHTML;
    listShowAllBtn.addEventListener("click", () => {
        if (typeof dom.modal.showModal === "function") {
            dom.modal.showModal();
        }
        dom.modal.dataset.activeListId = list.id;
        if (dom.shortcutsSearchInput) {
            dom.shortcutsSearchInput.value = "";
        }
        renderShortcutsGrid();
        dom.shortcutsSearchInput?.focus();
    });
    actions.appendChild(listShowAllBtn);

    if (state.editing && !list.locked) {
        const del = document.createElement("button");
        del.className = "list-icon-btn";
        del.type = "button";
        del.setAttribute("aria-label", `Supprimer la liste ${list.name}`);
        del.textContent = "−";
        del.addEventListener("click", () => removeList(list.id));
        actions.appendChild(del);
    }

    header.appendChild(title);
    header.appendChild(actions);

    const rail = document.createElement("div");
    rail.className = "shortcuts-rail";
    rail.dataset.listId = list.id;

    // drop zone pour déposer sur une liste vide / fin de liste
    rail.addEventListener("dragover", (event) => {
        if (!state.editing) {
            return;
        }
        event.preventDefault();
        listEl.classList.add("drag-over");
    });
    rail.addEventListener("dragleave", () => listEl.classList.remove("drag-over"));
    rail.addEventListener("drop", (event) => {
        if (!state.editing) {
            return;
        }
        event.preventDefault();
        listEl.classList.remove("drag-over");
        const payloadText = state.dragging?.payload || event.dataTransfer.getData("application/json") || "";
        let payload;
        try {
            payload = payloadText ? JSON.parse(payloadText) : null;
        } catch {
            payload = null;
        }
        if (!payload || !payload.entryId || !payload.fromListId) {
            return;
        }
        if (payload.fromListId === list.id) {
            return;
        }
        copyEntryToList(payload.entryId, list.id, "");
    });

    const entryIds = state.listEntryIds[list.id] || [];
    entryIds.forEach((entryId) => {
        rail.appendChild(createEntryElement(entryId, list.id));
    });

    // Add + Show all (conserver le comportement existant) dans la liste Épinglés
    if (list.id === PINNED_LIST_ID) {
        const addCard = document.createElement("button");
        addCard.className = "shortcut-add";
        addCard.type = "button";
        addCard.innerHTML = '<span class="shortcut-icon">+</span><span class="shortcut-name">Ajouter</span>';
        addCard.addEventListener("click", () => openShortcutDialog("add", ""));

        const holder = document.createElement("div");
        holder.className = "shortcut-item";
        holder.appendChild(addCard);
        rail.appendChild(holder);

        // Le bouton "Tout afficher" est dans le header de la liste.
    }

    listEl.appendChild(header);
    listEl.appendChild(rail);
    return listEl;
}

function renderShortcutsGrid() {
    dom.shortcutsGrid.innerHTML = "";
    const filteredShortcuts = getFilteredShortcuts();
    const activeListId = dom.modal?.dataset?.activeListId || "";
    let listShortcutIds = null;
    if (activeListId) {
        const entryIds = state.listEntryIds[activeListId] || [];
        listShortcutIds = new Set(entryIds.map((eid) => state.entriesById[eid]?.shortcutId).filter(Boolean));
    }

    filteredShortcuts
        .filter((shortcut) => {
            if (!listShortcutIds) {
                return true;
            }
            return listShortcutIds.has(shortcut.id);
        })
        .forEach((shortcut) => {
            dom.shortcutsGrid.appendChild(createShortcutSourceElement(shortcut));
        });

    if (filteredShortcuts.length === 0) {
        const empty = document.createElement("p");
        empty.className = "shortcuts-empty";
        empty.textContent = "Aucun raccourci trouve";
        dom.shortcutsGrid.appendChild(empty);
    }
}

function renderShortcuts() {
    renderLists();
    renderShortcutsGrid();
    if (dom.addListBtn) {
        dom.addListBtn.hidden = !state.editing;
    }
}

function createShortcutSourceElement(shortcut) {
    // Utilisé dans la grille "Tout afficher" : cliquer = ouvrir, en mode édition on peut aussi "Ajouter à..." via le bouton edit
    const wrapper = document.createElement("div");
    wrapper.className = "shortcut-item";
    wrapper.dataset.shortcutId = shortcut.id;

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.type = "button";
    editBtn.setAttribute("aria-label", `Modifier ${shortcut.name}`);
    editBtn.textContent = "...";
    editBtn.addEventListener("click", (event) => {
        event.preventDefault();
        // On édite le raccourci via une entrée éphémère: on ouvre le modal en mode edit-source.
        openShortcutDialog("edit-source", shortcut.id);
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

    if (state.editing) {
        link.addEventListener("click", (event) => event.preventDefault());
    }

    attachLongPress(wrapper);
    wrapper.appendChild(editBtn);
    wrapper.appendChild(link);
    return wrapper;
}

function moveEntry(fromListId, toListId, entryId, beforeEntryId) {
    if (!fromListId || !toListId || !entryId) {
        return;
    }
    if (!state.listEntryIds[fromListId] || !state.listEntryIds[toListId]) {
        return;
    }

    // retirer de la liste source
    state.listEntryIds[fromListId] = state.listEntryIds[fromListId].filter((id) => id !== entryId);

    // insérer dans la destination
    const dest = state.listEntryIds[toListId];
    if (beforeEntryId && dest.includes(beforeEntryId)) {
        const idx = dest.indexOf(beforeEntryId);
        dest.splice(idx, 0, entryId);
    } else {
        dest.push(entryId);
    }
    renderShortcuts();
    saveState();
}

function copyEntryToList(fromEntryId, toListId, beforeEntryId) {
    const srcEntry = state.entriesById[fromEntryId];
    if (!srcEntry) {
        return;
    }
    if (!state.listEntryIds[toListId]) {
        return;
    }

    const newEntryId = createId("e");
    state.entriesById[newEntryId] = {
        id: newEntryId,
        shortcutId: srcEntry.shortcutId,
        addedAt: Date.now()
    };

    const dest = state.listEntryIds[toListId];
    if (beforeEntryId && dest.includes(beforeEntryId)) {
        const idx = dest.indexOf(beforeEntryId);
        dest.splice(idx, 0, newEntryId);
    } else {
        dest.push(newEntryId);
    }

    renderShortcuts();
    saveState();
}

function attachDragAndDrop(element) {
    element.addEventListener("dragstart", (event) => {
        if (!state.editing) {
            event.preventDefault();
            return;
        }

        const entryId = element.dataset.entryId;
        const fromListId = element.dataset.listId;
        if (!entryId || !fromListId) {
            event.preventDefault();
            return;
        }

        state.dragging = { entryId, fromListId, payload: "" };
        const payload = JSON.stringify({ entryId, fromListId });
        state.dragging.payload = payload;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/json", payload);
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
        const payloadText = state.dragging?.payload || event.dataTransfer.getData("application/json") || "";
        let payload;
        try {
            payload = payloadText ? JSON.parse(payloadText) : null;
        } catch {
            payload = null;
        }
        if (!payload || !payload.entryId || !payload.fromListId) {
            return;
        }
        const toEntryId = element.dataset.entryId;
        const toListId = element.dataset.listId;
        if (!toEntryId || !toListId) {
            return;
        }
        if (payload.fromListId === toListId) {
            moveEntry(payload.fromListId, toListId, payload.entryId, toEntryId);
        } else {
            copyEntryToList(payload.entryId, toListId, toEntryId);
        }
    });

    element.addEventListener("dragend", () => {
        state.dragging = null;
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

function enableGlobalEditLongPress() {
    const host = dom.listsContainer;
    if (!host) {
        return;
    }

    let timer = null;
    let pointerId = null;

    const clear = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        pointerId = null;
    };

    host.addEventListener("pointerdown", (event) => {
        if (state.editing) {
            return;
        }
        // Ne pas déclencher si on interagit avec un contrôle
        if (event.target.closest("button, a, input, textarea, select, dialog")) {
            return;
        }
        // Ne pas déclencher quand on est en train de drag-scroll / drag&drop
        if (event.target.closest(".shortcuts-rail")) {
            // Sur le rail, on laisse plutôt le drag-scroll; long press sur les items géré ailleurs
            return;
        }

        pointerId = event.pointerId;
        timer = setTimeout(() => {
            // Si un autre pointer a pris le relais, ignore
            if (pointerId !== event.pointerId) {
                return;
            }
            setEditing(true);
        }, LONG_PRESS_MS);
    });

    ["pointerup", "pointerleave", "pointercancel"].forEach((name) => {
        host.addEventListener(name, clear);
    });
}

function setEditing(isEditing) {
    state.editing = isEditing;
    document.body.classList.toggle("editing", isEditing);
    renderShortcuts();
}

function removeEntry(entryId) {
    const listId = getEntryListId(entryId);
    if (listId) {
        state.listEntryIds[listId] = (state.listEntryIds[listId] || []).filter((id) => id !== entryId);
    }
    delete state.entriesById[entryId];
    renderShortcuts();
    saveState();
}

function removeShortcutEverywhere(shortcutId) {
    // supprime toutes les entrées qui pointent vers ce shortcut
    const toDeleteEntryIds = Object.values(state.entriesById)
        .filter((e) => e.shortcutId === shortcutId)
        .map((e) => e.id);
    toDeleteEntryIds.forEach((entryId) => {
        const listId = getEntryListId(entryId);
        if (listId) {
            state.listEntryIds[listId] = (state.listEntryIds[listId] || []).filter((id) => id !== entryId);
        }
        delete state.entriesById[entryId];
    });
    delete state.shortcutsById[shortcutId];
    renderShortcuts();
    saveState();
}

function openDeleteDialog(entryId, shortcutId, name) {
    state.deleteTargetEntryId = entryId;
    state.deleteTargetShortcutId = shortcutId;
    dom.deleteShortcutName.textContent = name;
    if (typeof dom.shortcutDeleteModal.showModal === "function") {
        dom.shortcutDeleteModal.showModal();
    }
}

function closeDeleteDialog() {
    state.deleteTargetEntryId = "";
    state.deleteTargetShortcutId = "";
    dom.shortcutDeleteModal.close();
}

function confirmDeleteShortcut() {
    if (!state.deleteTargetEntryId) {
        closeDeleteDialog();
        return;
    }

    const originListId = getEntryListId(state.deleteTargetEntryId);
    if (originListId === PINNED_LIST_ID && state.deleteTargetShortcutId) {
        // Depuis "Épinglés" : supprime partout (toutes les copies)
        removeShortcutEverywhere(state.deleteTargetShortcutId);
    } else {
        // Dans une liste : ne supprime que la copie (entrée)
        removeEntry(state.deleteTargetEntryId);
    }
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

function openShortcutDialog(mode, id = "") {
    if (state.editing) {
        setEditing(false);
    }

    state.editingEntryId = "";

    if (mode === "edit") {
        // id = entryId
        const entry = state.entriesById[id];
        const shortcut = getShortcutForEntry(entry);
        if (!entry || !shortcut) {
            return;
        }
        state.editingEntryId = id;

        dom.shortcutFormTitle.textContent = "Modifier le raccourci";
        dom.shortcutId.value = shortcut.id;
        dom.shortcutName.value = shortcut.name;
        dom.shortcutUrl.value = shortcut.url;
        dom.shortcutImageUrl.value = shortcut.customIconUrl || "";

    } else if (mode === "edit-source") {
        // édition depuis la grille "tout afficher" (raccourci source)
        const shortcut = state.shortcutsById[id];
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
    state.editingEntryId = "";
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
        const shortcut = state.shortcutsById[id];
        if (!shortcut) {
            return;
        }
        shortcut.name = name;
        shortcut.url = normalizedUrl;
        shortcut.icon = icon;
        shortcut.customIconUrl = customIconUrl;
        shortcut.updatedAt = Date.now();

    } else {
        const shortcutId = createId("s");
        state.shortcutsById[shortcutId] = {
            id: shortcutId,
            name,
            url: normalizedUrl,
            icon,
            customIconUrl,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Par défaut, nouveau raccourci => ajouté dans Épinglés
        const listId = PINNED_LIST_ID;
        const entryId = createId("e");
        state.entriesById[entryId] = { id: entryId, shortcutId, addedAt: Date.now() };
        state.listEntryIds[listId].push(entryId);
    }

    closeShortcutDialog();
    renderShortcuts();
    saveState();
}


function addList(name) {
    const clean = (name || "").trim() || "Nouvelle liste";
    const id = createId("l");
    state.lists.push({ id, name: clean.slice(0, 40), locked: false, createdAt: Date.now() });
    state.listEntryIds[id] = [];
    renderShortcuts();
    saveState();
}

function renameList(listId, nextName) {
    const list = getListById(listId);
    if (!list || list.locked) {
        return;
    }
    const clean = (nextName || "").trim() || "Liste";
    list.name = clean.slice(0, 40);
    renderShortcuts();
    saveState();
}

function removeList(listId) {
    const list = getListById(listId);
    if (!list || list.locked || listId === PINNED_LIST_ID) {
        return;
    }
    // supprimer uniquement les entrées de cette liste (copies)
    const entryIds = state.listEntryIds[listId] || [];
    entryIds.forEach((entryId) => {
        delete state.entriesById[entryId];
    });
    delete state.listEntryIds[listId];
    state.lists = state.lists.filter((l) => l.id !== listId);
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

    if (dom.showShortcutNames) {
        dom.showShortcutNames.addEventListener("change", () => {
            state.clock.showShortcutNames = dom.showShortcutNames.checked;
            applyClockStyle();
            saveState();
        });
    }

    dom.showAllBtn.addEventListener("click", () => {
        if (typeof dom.modal.showModal === "function") {
            dom.modal.showModal();
        }
        if (dom.modal?.dataset) {
            delete dom.modal.dataset.activeListId;
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

    dom.modal.addEventListener("close", () => {
        if (dom.modal?.dataset) {
            delete dom.modal.dataset.activeListId;
        }
    });

    dom.deleteCancelBtn.addEventListener("click", closeDeleteDialog);
    dom.deleteConfirmBtn.addEventListener("click", confirmDeleteShortcut);

    if (dom.addListBtn) {
        dom.addListBtn.addEventListener("click", () => {
            const name = window.prompt("Nom de la liste :", "Nouvelle liste");
            if (name === null) {
                return;
            }
            addList(name);
        });
    }

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

    // Drag scroll sur tous les rails (delegation)
    document.addEventListener("pointerdown", (event) => {
        const rail = event.target.closest(".shortcuts-rail");
        if (!rail) {
            return;
        }
        // Ne pas capturer si c'est un bouton ou un lien
        if (event.target.closest("button, a")) {
            return;
        }
        isDown = true;
        startX = event.clientX;
        scrollLeft = rail.scrollLeft;
        rail.setPointerCapture(event.pointerId);
        rail.dataset.dragScrollActive = "1";
    });

    document.addEventListener("pointermove", (event) => {
        if (!isDown) {
            return;
        }
        const rail = event.target.closest(".shortcuts-rail") || document.querySelector('.shortcuts-rail[data-drag-scroll-active="1"]');
        if (!rail) {
            return;
        }
        const walk = event.clientX - startX;
        rail.scrollLeft = scrollLeft - walk;
    });

    const stop = () => {
        isDown = false;
    };

    document.addEventListener("pointerup", () => {
        isDown = false;
        document.querySelectorAll('.shortcuts-rail[data-drag-scroll-active="1"]').forEach((rail) => {
            delete rail.dataset.dragScrollActive;
        });
    });
    document.addEventListener("pointercancel", stop);
}

async function init() {
    await loadState();
    syncClockControls();
    setClockSettingsOpen(false);
    renderShortcuts();
    updateClock();
    bindEvents();
    enableGlobalEditLongPress();
    setInterval(updateClock, 1000);
}

init();

