(() => {
"use strict";

const {parseMath} = globalThis.ClasspadMathParser;
const {isLikelyMath, identifyImportedFormulae} = globalThis.ClasspadMathDetection;

const editor = document.getElementById("editor");
const status = document.getElementById("status");
const course = document.getElementById("course");
const courseSelectedName = document.getElementById("courseSelectedName");
const courseList = document.getElementById("courseList");
const addCourseBtn = document.getElementById("addCourseBtn");
const renameCourseBtn = document.getElementById("renameCourseBtn");
const courseActionMenu = document.getElementById("courseActionMenu");
const courseFiles = document.getElementById("courseFiles");
const courseFileCount = document.getElementById("courseFileCount");
const newCourseFileBtn = document.getElementById("newCourseFileBtn");
const refreshCourseFilesBtn = document.getElementById("refreshCourseFilesBtn");
const fileActionMenu = document.getElementById("fileActionMenu");
const fileActionBackdrop = document.getElementById("fileActionBackdrop");
const fileActionTitle = document.getElementById("fileActionTitle");
const fileActionDescription = document.getElementById("fileActionDescription");
const fileRenameField = document.getElementById("fileRenameField");
const fileRenameLabel = document.getElementById("fileRenameLabel");
const fileRenameInput = document.getElementById("fileRenameInput");
const fileMoveField = document.getElementById("fileMoveField");
const fileMoveCourse = document.getElementById("fileMoveCourse");
const fileActionError = document.getElementById("fileActionError");
const cancelFileActionBtn = document.getElementById("cancelFileActionBtn");
const confirmFileActionBtn = document.getElementById("confirmFileActionBtn");
const title = document.getElementById("title");
const clock = document.getElementById("clock");
const themeToggle = document.getElementById("themeToggle");

const courseFolderBackdrop = document.getElementById("courseFolderBackdrop");
const courseFolderTitle = document.getElementById("courseFolderTitle");
const courseFolderDescription = document.getElementById("courseFolderDescription");
const courseFolderInput = document.getElementById("courseFolderInput");
const courseFolderError = document.getElementById("courseFolderError");
const cancelCourseFolderBtn = document.getElementById("cancelCourseFolderBtn");
const saveCourseFolderBtn = document.getElementById("saveCourseFolderBtn");

const menuBtn = document.getElementById("menuBtn");
const mainMenu = document.getElementById("mainMenu");
const markdownTransferBtn = document.getElementById("markdownTransferBtn");
const printDocumentBtn = document.getElementById("printDocumentBtn");
const resetApplicationBtn = document.getElementById("resetApplicationBtn");
const markdownTransferBackdrop = document.getElementById("markdownTransferBackdrop");
const markdownTransferInput = document.getElementById("markdownTransferInput");
const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
const cancelMarkdownTransferBtn = document.getElementById("cancelMarkdownTransferBtn");
const importMarkdownBtn = document.getElementById("importMarkdownBtn");

const storagePathBtn = document.getElementById("storagePathBtn");
const storagePathBackdrop = document.getElementById("storagePathBackdrop");
const storagePathModal = document.getElementById("storagePathModal");
const storagePathInput = document.getElementById("storagePathInput");
const storagePathError = document.getElementById("storagePathError");
const browseStoragePathBtn = document.getElementById("browseStoragePathBtn");
const storageBrowser = document.getElementById("storageBrowser");
const storageDrivesBtn = document.getElementById("storageDrivesBtn");
const storageParentBtn = document.getElementById("storageParentBtn");
const storageBrowserPath = document.getElementById("storageBrowserPath");
const storageBrowserStatus = document.getElementById("storageBrowserStatus");
const storageBrowserList = document.getElementById("storageBrowserList");
const cancelStoragePathBtn = document.getElementById("cancelStoragePathBtn");
const saveStoragePathBtn = document.getElementById("saveStoragePathBtn");

const modalBackdrop = document.getElementById("modalBackdrop");
const formulaInput = document.getElementById("formulaInput");
const formulaPreview = document.getElementById("formulaPreview");
const formulaError = document.getElementById("formulaError");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const toTextBtn = document.getElementById("toTextBtn");

let editingToken = null;
let saveTimer = null;
let titleRenameTimer = null;
let titleRenameQueue = Promise.resolve();
let saveInProgress = false;
let savePending = false;
let saveIdleResolvers = [];
let markdownComposing = false;
let storageParentPath = null;
let storageBrowserRequestId = 0;
let courseFolderMode = "create";
let courseFolderTarget = "";
let courseRequestId = 0;
let courseFilesRequestId = 0;
let courseChangeRequestId = 0;
let padContentRequestId = 0;
let storageRootPath = "";
let courseNames = [];
let padCourse = "";
let loadedPad = null;
let activeCourseFile = null;
let fileActionTrigger = null;
let fileActionMode = "rename";
let courseActionTrigger = null;
let activeCourseName = "";
const draftStorageKey = "classpad-unsaved-draft";
let activeDraft = null;

function persistDraft() {
  const draft = JSON.stringify({
    version:1,
    course:padCourse || course.value,
    title:title.value,
    markdown:exportToMarkdown(),
    filename:loadedPad?.filename || null
  });
  try {
    localStorage.setItem(draftStorageKey, draft);
    activeDraft = draft;
  } catch {
    // Disk saving must remain available when browser storage is unavailable.
  }
}

function clearDraft(expectedDraft) {
  try {
    if (expectedDraft && localStorage.getItem(draftStorageKey) === expectedDraft) {
      localStorage.removeItem(draftStorageKey);
    }
    if (activeDraft === expectedDraft) activeDraft = null;
  } catch {
    // Browser storage may be disabled or full.
  }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(draftStorageKey);
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || typeof draft.markdown !== "string"
      || typeof draft.title !== "string" || typeof draft.course !== "string"
      || (draft.filename !== null && typeof draft.filename !== "string")) return "";
    const imported = identifyImportedFormulae(normalizeMarkdownEnd(draft.markdown));
    renderMarkdown(imported.source, imported.formulae, 0);
    title.value = draft.title;
    padCourse = draft.course;
    loadedPad = draft.filename ? createLoadedPadReference(draft.course, draft.filename) : null;
    activeDraft = raw;
    status.textContent = "Brouillon non sauvegardé restauré";
    status.className = "status-warn";
    return draft.course;
  } catch {
    // Ignore invalid or inaccessible drafts without preventing startup.
    return "";
  }
}

function createLoadedPadReference(courseName, filename) {
  return {
    course:courseName,
    filename,
    path:`${courseName}/${filename}`
  };
}

// ------------------------------------------------------------
// Thème clair / sombre
// ------------------------------------------------------------
function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Activer le mode clair" : "Activer le mode sombre");
  themeToggle.title = isDark ? "Activer le mode clair" : "Activer le mode sombre";
}

let savedTheme = "light";
try {
  savedTheme = localStorage.getItem("classpad-theme") === "dark" ? "dark" : "light";
} catch {
  // Le stockage local peut être indisponible selon le contexte d'exécution.
}
applyTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(theme);
  try {
    localStorage.setItem("classpad-theme", theme);
  } catch {
    // Le choix reste actif pour la session courante.
  }
});

// ------------------------------------------------------------
// Horloge / cours
// ------------------------------------------------------------
function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleString("fr-BE", {
    weekday:"short", day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit"
  });
}
updateClock();
setInterval(updateClock, 30000);

// Exemple très simple de déduction du cours selon l'horaire.
// À adapter avec le véritable horaire de Phileas.
const timetable = [
  // { day: 1, start: "08:30", end: "09:20", course: "Mathématiques" },
];

function getSuggestedCourseFromTime() {
  if (!timetable.length) return "";
  const now = new Date();
  const day = now.getDay();
  const hhmm = String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0");
  const hit = timetable.find(x => x.day === day && hhmm >= x.start && hhmm <= x.end);
  return hit?.course || "";
}

// ------------------------------------------------------------
// Menu principal / chemin de stockage
// ------------------------------------------------------------
function setMenuOpen(open) {
  mainMenu.hidden = !open;
  menuBtn.setAttribute("aria-expanded", String(open));
}

menuBtn.addEventListener("click", () => {
  setMenuOpen(mainMenu.hidden);
});

document.addEventListener("mousedown", (event) => {
  if (!mainMenu.hidden && !event.target.closest(".menu-container")) {
    setMenuOpen(false);
  }
});

resetApplicationBtn.addEventListener("click", async () => {
  const confirmed = window.confirm(
    "Réinitialiser ClassPad ? Toutes les données de la base locale seront supprimées."
  );
  if (!confirmed) return;

  resetApplicationBtn.disabled = true;
  resetApplicationBtn.textContent = "Réinitialisation…";
  status.textContent = "Réinitialisation de ClassPad…";
  status.className = "status-warn";

  try {
    const response = await fetch("/?do=classpad_system_reset", {method:"POST"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    window.location.reload();
  } catch {
    resetApplicationBtn.disabled = false;
    resetApplicationBtn.textContent = "Réinitialiser";
    status.textContent = "Impossible de réinitialiser ClassPad";
    status.className = "status-warn";
  }
});

function setStorageBrowserOpen(open) {
  storageBrowser.hidden = !open;
  browseStoragePathBtn.setAttribute("aria-expanded", String(open));
  storagePathModal.classList.toggle("storage-browser-open", open);
}

function setStorageBrowserStatus(message, isError = false) {
  storageBrowserStatus.textContent = message;
  storageBrowserStatus.classList.toggle("error", isError);
}

function formatStorageSize(size) {
  if (!Number.isFinite(size) || size < 0) return "";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 && unit ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

function createStorageEntry(entry) {
  const isDirectory = entry.type === "directory" || entry.type === "drive" || entry.type === "mount" || entry.type === "system";
  const row = document.createElement(isDirectory ? "button" : "div");
  row.className = `storage-browser-entry ${isDirectory ? (entry.type === "directory" ? "directory" : "drive") : "file"}`;
  row.setAttribute("role", "listitem");
  if (isDirectory) row.type = "button";

  const name = document.createElement("span");
  name.className = "storage-entry-name";
  name.textContent = entry.name || entry.path;
  row.appendChild(name);

  const meta = document.createElement("span");
  meta.className = "storage-entry-meta";
  if (entry.type === "file") {
    meta.textContent = formatStorageSize(Number(entry.size));
  } else if (entry.free !== null && entry.free !== undefined && Number.isFinite(Number(entry.free))) {
    meta.textContent = `${formatStorageSize(Number(entry.free))} libres`;
  }
  row.appendChild(meta);

  if (isDirectory) {
    row.title = entry.path;
    row.addEventListener("click", () => loadStorageDirectory(entry.path));
  }

  return row;
}

function renderStorageEntries(entries) {
  storageBrowserList.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "storage-browser-entry file";
    empty.textContent = "Ce dossier est vide.";
    storageBrowserList.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  entries.forEach(entry => fragment.appendChild(createStorageEntry(entry)));
  storageBrowserList.appendChild(fragment);
}

async function fetchStorageData(controller, params = {}) {
  const query = new URLSearchParams({get:controller, ...params});
  const response = await fetch(`/?${query.toString()}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data?.errors) throw new Error(Object.values(data.errors).join(" "));
  return data;
}

function renderCourses(names, preferredCourse = "") {
  courseNames = [...names];
  courseList.replaceChildren();

  if (!names.length) {
    course.value = "";
    courseSelectedName.textContent = "Aucun dossier de cours";
    course.disabled = true;
    setCourseListOpen(false);
    return;
  }

  const fragment = document.createDocumentFragment();
  names.forEach(name => {
    const item = document.createElement("div");
    item.className = "course-list-item";

    const selectButton = document.createElement("button");
    selectButton.className = "course-list-select";
    selectButton.type = "button";
    selectButton.setAttribute("role", "option");
    selectButton.setAttribute("aria-selected", String(name === preferredCourse));
    selectButton.textContent = name;
    selectButton.title = name;
    selectButton.addEventListener("click", () => selectCourse(name));
    item.appendChild(selectButton);

    const actionButton = document.createElement("button");
    actionButton.className = "course-list-actions";
    actionButton.type = "button";
    actionButton.textContent = "•••";
    actionButton.title = `Actions pour ${name}`;
    actionButton.setAttribute("aria-label", `Actions pour ${name}`);
    actionButton.setAttribute("aria-haspopup", "menu");
    actionButton.setAttribute("aria-expanded", "false");
    actionButton.addEventListener("click", event => {
      event.stopPropagation();
      openCourseActionMenu(name, actionButton);
    });
    item.appendChild(actionButton);
    fragment.appendChild(item);
  });
  courseList.appendChild(fragment);
  course.disabled = false;
  course.value = names.includes(preferredCourse) ? preferredCourse : names[0];
  courseSelectedName.textContent = course.value;
  updateSelectedCourseRow();
}

function setCoursePlaceholder(message) {
  course.value = "";
  courseSelectedName.textContent = message;
  course.disabled = true;
  setCourseListOpen(false);
}

function updateSelectedCourseRow() {
  courseList.querySelectorAll(".course-list-item").forEach((item, index) => {
    const selected = courseNames[index] === course.value;
    item.classList.toggle("selected", selected);
    item.querySelector(".course-list-select")?.setAttribute("aria-selected", String(selected));
  });
}

function setCourseListOpen(open) {
  const shouldOpen = Boolean(open && !course.disabled && courseNames.length);
  courseList.hidden = !shouldOpen;
  course.setAttribute("aria-expanded", String(shouldOpen));
  if (!shouldOpen) closeCourseActionMenu();
}

function selectCourse(name) {
  setCourseListOpen(false);
  if (!courseNames.includes(name) || name === course.value) {
    course.focus();
    return;
  }
  course.value = name;
  courseSelectedName.textContent = name;
  updateSelectedCourseRow();
  course.dispatchEvent(new Event("change"));
}

function closeCourseActionMenu(restoreFocus = false) {
  if (courseActionTrigger) {
    courseActionTrigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) courseActionTrigger.focus();
  }
  courseActionMenu.hidden = true;
  courseActionTrigger = null;
  activeCourseName = "";
}

function openCourseActionMenu(name, trigger) {
  if (courseActionTrigger === trigger && !courseActionMenu.hidden) {
    closeCourseActionMenu(true);
    return;
  }

  closeCourseActionMenu();
  activeCourseName = name;
  courseActionTrigger = trigger;
  trigger.setAttribute("aria-expanded", "true");
  courseActionMenu.hidden = false;

  const triggerRect = trigger.getBoundingClientRect();
  const menuRect = courseActionMenu.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(
    window.innerWidth - menuRect.width - margin,
    Math.max(margin, triggerRect.right - menuRect.width)
  );
  const roomBelow = window.innerHeight - triggerRect.bottom;
  const top = roomBelow >= menuRect.height + margin
    ? triggerRect.bottom + 4
    : Math.max(margin, triggerRect.top - menuRect.height - 4);
  courseActionMenu.style.left = `${left}px`;
  courseActionMenu.style.top = `${top}px`;
  renameCourseBtn.focus();
}

function getCoursePath() {
  if (!storageRootPath || !course.value) return "";
  const separator = storageRootPath.includes("\\") ? "\\" : "/";
  return `${storageRootPath.replace(/[\\/]+$/, "")}${separator}${course.value}`;
}

function renderCourseFiles(files, message = "") {
  closeFileActionMenu();
  courseFiles.replaceChildren();
  courseFileCount.textContent = files.length ? String(files.length) : "";

  if (!files.length) {
    const empty = document.createElement("div");
    empty.className = "files-message";
    empty.textContent = message || "Aucun fichier dans ce cours.";
    courseFiles.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  files.forEach(file => {
    const item = document.createElement("div");
    item.className = "course-file";
    item.setAttribute("role", "listitem");
    if (loadedPad?.course === course.value && loadedPad.filename === file.name) {
      item.classList.add("selected");
    }

    const openButton = document.createElement("button");
    openButton.className = "course-file-open";
    openButton.type = "button";
    openButton.title = `Ouvrir ${file.name}`;
    openButton.setAttribute("aria-label", `Ouvrir ${file.name}`);
    openButton.addEventListener("click", () => loadCoursePad(file, item));

    const name = document.createElement("span");
    name.className = "course-file-name";
    name.textContent = file.name.replace(/\.md$/i, "");
    openButton.appendChild(name);
    item.appendChild(openButton);

    const actionButton = document.createElement("button");
    actionButton.className = "course-file-actions";
    actionButton.type = "button";
    actionButton.textContent = "•••";
    actionButton.title = `Actions pour ${file.name}`;
    actionButton.setAttribute("aria-label", `Actions pour ${file.name}`);
    actionButton.setAttribute("aria-haspopup", "menu");
    actionButton.setAttribute("aria-expanded", "false");
    actionButton.addEventListener("click", event => {
      event.stopPropagation();
      openFileActionMenu(file, actionButton);
    });
    item.appendChild(actionButton);

    const modified = new Date(Number(file.modified) * 1000);
    const details = Number.isNaN(modified.getTime())
      ? formatStorageSize(Number(file.size))
      : modified.toLocaleDateString("fr-BE", {day:"2-digit", month:"short", year:"numeric"});
    item.title = `${file.name} · ${details}`;
    fragment.appendChild(item);
  });
  courseFiles.appendChild(fragment);
}

async function loadCoursePad(file, item) {
  const requestId = ++padContentRequestId;
  closeFileActionMenu();
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!saveInProgress) await doSave();
    if (requestId !== padContentRequestId) return;
  }
  courseFiles.querySelectorAll(".course-file.loading").forEach(row => row.classList.remove("loading"));
  item.classList.add("loading");
  status.textContent = `Chargement de ${file.name}…`;
  status.className = "status-warn";

  try {
    const data = await fetchStorageData("classpad_storage_pad-content", {
      course:course.value,
      filename:file.name
    });
    if (requestId !== padContentRequestId) return;

    const markdown = normalizeMarkdownEnd(typeof data.markdown === "string" ? data.markdown : "");
    const imported = identifyImportedFormulae(markdown);
    renderMarkdown(imported.source, imported.formulae, 0);
    const subject = typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : file.name.replace(/\.md$/i, "");
    title.value = subject;
    document.title = `${course.value} - ${subject}`;
    loadedPad = createLoadedPadReference(course.value, file.name);
    activeDraft = null;
    courseFiles.querySelectorAll(".course-file.selected").forEach(row => row.classList.remove("selected"));
    item.classList.add("selected");
    editor.focus();
    status.textContent = `Fichier chargé : ${file.name}`;
    status.className = "status-ok";
  } catch {
    if (requestId !== padContentRequestId) return;
    status.textContent = "Impossible de charger ce fichier.";
    status.className = "status-warn";
  } finally {
    if (requestId === padContentRequestId) item.classList.remove("loading");
  }
}

function closeFileActionMenu(restoreFocus = false) {
  if (fileActionTrigger) {
    fileActionTrigger.setAttribute("aria-expanded", "false");
    fileActionTrigger.closest(".course-file")?.classList.remove("menu-open");
    if (restoreFocus) fileActionTrigger.focus();
  }
  fileActionMenu.hidden = true;
  fileActionTrigger = null;
}

function openFileActionMenu(file, trigger) {
  if (fileActionTrigger === trigger && !fileActionMenu.hidden) {
    closeFileActionMenu(true);
    return;
  }

  closeFileActionMenu();
  activeCourseFile = file;
  fileActionTrigger = trigger;
  trigger.setAttribute("aria-expanded", "true");
  trigger.closest(".course-file")?.classList.add("menu-open");
  fileActionMenu.hidden = false;

  const triggerRect = trigger.getBoundingClientRect();
  const menuRect = fileActionMenu.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(
    window.innerWidth - menuRect.width - margin,
    Math.max(margin, triggerRect.right - menuRect.width)
  );
  const roomBelow = window.innerHeight - triggerRect.bottom;
  const top = roomBelow >= menuRect.height + margin
    ? triggerRect.bottom + 4
    : Math.max(margin, triggerRect.top - menuRect.height - 4);
  fileActionMenu.style.left = `${left}px`;
  fileActionMenu.style.top = `${top}px`;
  fileActionMenu.querySelector("button")?.focus();
}

function openFileAction(mode) {
  if (mode !== "create" && !activeCourseFile) return;
  if (mode === "create" && (!course.value || course.disabled)) return;
  closeFileActionMenu();
  fileActionMode = mode;
  fileActionError.textContent = "";
  fileRenameField.hidden = mode !== "rename" && mode !== "create";
  fileMoveField.hidden = mode !== "move";
  confirmFileActionBtn.classList.toggle("danger", mode === "delete");

  if (mode === "create") {
    activeCourseFile = null;
    fileActionTitle.textContent = "Créer un fichier";
    fileActionDescription.textContent = `Le fichier vide sera créé dans « ${course.value} ».`;
    fileRenameLabel.textContent = "Sujet";
    fileRenameInput.value = "";
    confirmFileActionBtn.textContent = "Créer";
  } else if (mode === "rename") {
    fileActionTitle.textContent = "Renommer le fichier";
    fileActionDescription.textContent = activeCourseFile.name;
    fileRenameLabel.textContent = "Nouveau nom";
    fileRenameInput.value = activeCourseFile.name.replace(/\.md$/i, "");
    confirmFileActionBtn.textContent = "Renommer";
  } else if (mode === "delete") {
    fileActionTitle.textContent = "Supprimer le fichier";
    fileActionDescription.textContent = `« ${activeCourseFile.name} » sera supprimé définitivement.`;
    confirmFileActionBtn.textContent = "Supprimer";
  } else {
    fileActionTitle.textContent = "Déplacer le fichier";
    fileActionDescription.textContent = `Choisis le nouveau cours pour « ${activeCourseFile.name} ».`;
    confirmFileActionBtn.textContent = "Déplacer";
    fileMoveCourse.replaceChildren();
    courseNames
      .filter(name => name && name !== course.value)
      .forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        fileMoveCourse.appendChild(option);
      });
    if (!fileMoveCourse.options.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Aucun autre cours disponible";
      fileMoveCourse.appendChild(option);
    }
  }

  fileActionBackdrop.classList.add("open");
  setTimeout(() => {
    if (mode === "rename" || mode === "create") {
      fileRenameInput.focus();
      fileRenameInput.select();
    } else if (mode === "move") {
      fileMoveCourse.focus();
    } else {
      confirmFileActionBtn.focus();
    }
  }, 0);
}

function closeFileAction() {
  fileActionBackdrop.classList.remove("open");
  fileActionError.textContent = "";
  activeCourseFile = null;
}

async function submitFileAction() {
  if (fileActionMode !== "create" && !activeCourseFile) return;

  if (fileActionMode === "create") {
    const subject = fileRenameInput.value.trim();
    if (!subject) {
      fileActionError.textContent = "Indique un sujet.";
      fileRenameInput.focus();
      return;
    }

    confirmFileActionBtn.disabled = true;
    fileActionError.textContent = "Création…";
    try {
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      if (title.value.trim()) {
        await doSave(padCourse || course.value, false);
        await waitForSaveIdle();
      }

      const payload = new URLSearchParams({
        course:course.value,
        subject,
        date_time:formatLocalDateTime(new Date()),
        markdown:"",
        create_only:"true"
      });
      const response = await fetch("/?do=classpad_storage_save-pad", {
        method:"POST",
        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
        body:payload.toString()
      });
      const data = await response.json();
      if (!response.ok || data?.errors || typeof data.filename !== "string") {
        throw new Error("file_creation_failed");
      }

      padContentRequestId++;
      padCourse = course.value;
      loadedPad = createLoadedPadReference(course.value, data.filename);
      activeDraft = null;
      title.value = subject;
      renderMarkdown("", [], 0);
      closeFileAction();
      await loadCourseFiles();
      status.textContent = "Fichier vide créé";
      status.className = "status-ok";
      editor.focus();
    } catch {
      fileActionError.textContent = "Impossible de créer ce fichier. Vérifie le sujet ou choisis-en un autre.";
    } finally {
      confirmFileActionBtn.disabled = false;
    }
    return;
  }

  const selectedFile = activeCourseFile;
  const payload = new URLSearchParams({
    operation:fileActionMode,
    course:course.value,
    filename:selectedFile.name
  });

  if (fileActionMode === "rename") {
    let newName = fileRenameInput.value.trim();
    if (!newName) {
      fileActionError.textContent = "Indique un nom de fichier.";
      fileRenameInput.focus();
      return;
    }
    if (/\.md$/i.test(selectedFile.name) && !/\.md$/i.test(newName)) newName += ".md";
    if (newName === selectedFile.name) {
      closeFileAction();
      return;
    }
    payload.set("new_name", newName);
  } else if (fileActionMode === "move") {
    if (!fileMoveCourse.value) {
      fileActionError.textContent = "Ajoute un autre cours avant de déplacer ce fichier.";
      return;
    }
    payload.set("target_course", fileMoveCourse.value);
  }

  confirmFileActionBtn.disabled = true;
  fileActionError.textContent = fileActionMode === "delete" ? "Suppression…" : "Enregistrement…";
  try {
    const response = await fetch("/?do=classpad_storage_manage-file", {
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
      body:payload.toString()
    });
    const data = await response.json();
    if (!response.ok || data?.errors) throw new Error("file_action_failed");

    if (
      fileActionMode === "rename"
      && loadedPad?.course === course.value
      && loadedPad.filename === selectedFile.name
      && typeof data.filename === "string"
    ) {
      loadedPad.filename = data.filename;
      loadedPad.path = `${loadedPad.course}/${data.filename}`;
    }

    const successMessages = {
      rename:"Fichier renommé",
      delete:"Fichier supprimé",
      move:"Fichier déplacé"
    };
    closeFileAction();
    await loadCourseFiles();
    status.textContent = successMessages[fileActionMode];
    status.className = "status-ok";
  } catch {
    fileActionError.textContent = "Impossible d’effectuer cette action. Vérifie le nom et la destination.";
  } finally {
    confirmFileActionBtn.disabled = false;
  }
}

fileActionMenu.querySelectorAll("[data-file-action]").forEach(button => {
  button.addEventListener("click", () => openFileAction(button.dataset.fileAction));
});
document.addEventListener("mousedown", event => {
  if (!fileActionMenu.hidden && !fileActionMenu.contains(event.target) && event.target !== fileActionTrigger) {
    closeFileActionMenu();
  }
});
courseFiles.addEventListener("scroll", () => closeFileActionMenu(), {passive:true});
window.addEventListener("resize", () => {
  closeFileActionMenu();
  closeCourseActionMenu();
});
cancelFileActionBtn.addEventListener("click", closeFileAction);
confirmFileActionBtn.addEventListener("click", submitFileAction);
fileRenameInput.addEventListener("keydown", event => {
  if (event.key === "Enter") submitFileAction();
});
fileActionBackdrop.addEventListener("mousedown", event => {
  if (event.target === fileActionBackdrop) closeFileAction();
});

async function loadCourseFiles() {
  const requestId = ++courseFilesRequestId;
  const path = getCoursePath();
  newCourseFileBtn.disabled = !path;
  refreshCourseFilesBtn.disabled = !path;

  if (!path) {
    renderCourseFiles([], storageRootPath ? "Sélectionnez un cours." : "Configurez d’abord le dossier des fichiers.");
    return;
  }

  renderCourseFiles([], "Chargement des fichiers…");
  try {
    const data = await fetchStorageData("classpad_storage_files", {path, limit:"500"});
    if (requestId !== courseFilesRequestId) return;
    const files = Array.isArray(data.files) ? data.files : [];
    renderCourseFiles(files);
  } catch {
    if (requestId !== courseFilesRequestId) return;
    renderCourseFiles([], "Impossible de charger les fichiers de ce cours.");
  }
}

async function fetchCourseNames(path) {
  const names = [];
  let start = 0;
  let total = 0;

  do {
    const data = await fetchStorageData("classpad_storage_directories", {
      path,
      start:String(start),
      limit:"500"
    });
    const directories = Array.isArray(data.directories) ? data.directories : [];
    names.push(...directories
      .map(entry => entry.name)
      .filter(name => typeof name === "string" && name));
    total = Number(data.total || names.length);
    start += directories.length;
    if (!directories.length) break;
  } while (start < total);

  return names;
}

async function loadCourses(preferredCourse = course.value || getSuggestedCourseFromTime()) {
  const requestId = ++courseRequestId;
  storageRootPath = "";
  course.disabled = true;
  addCourseBtn.disabled = true;
  setCourseListOpen(false);

  try {
    const pathData = await fetchStorageData("classpad_storage_filesystem-path");
    if (requestId !== courseRequestId) return;
    const path = typeof pathData.path === "string" ? pathData.path.trim() : "";
    if (!path) {
      renderCourses([], preferredCourse);
      padCourse = "";
      setCoursePlaceholder("Configurez le dossier des fichiers");
      loadCourseFiles();
      await openStoragePath({initialPath:path, browseWhenEmpty:true});
      return;
    }

    storageRootPath = path;
    const names = await fetchCourseNames(path);
    if (requestId !== courseRequestId) return;
    addCourseBtn.disabled = false;
    renderCourses(names, preferredCourse);
    padCourse = course.value;
    loadCourseFiles();
  } catch {
    if (requestId !== courseRequestId) return;
    renderCourses([], preferredCourse);
    padCourse = "";
    setCoursePlaceholder("Cours indisponibles");
    loadCourseFiles();
  }
}

function openCourseFolder(mode, targetCourse = course.value) {
  if (mode === "rename" && !targetCourse) return;
  setCourseListOpen(false);
  closeCourseActionMenu();
  courseFolderMode = mode;
  courseFolderTarget = targetCourse;
  const isRename = mode === "rename";
  courseFolderTitle.textContent = isRename ? "Renommer le cours" : "Ajouter un cours";
  courseFolderDescription.textContent = isRename
    ? "Le dossier et tous les fichiers qu’il contient seront renommés."
    : "Un dossier portant ce nom sera créé dans le dossier des fichiers.";
  saveCourseFolderBtn.textContent = isRename ? "Renommer" : "Ajouter";
  courseFolderInput.value = isRename ? courseFolderTarget : "";
  courseFolderError.textContent = "";
  courseFolderBackdrop.classList.add("open");
  courseFolderInput.focus();
  courseFolderInput.select();
}

function closeCourseFolder() {
  courseFolderBackdrop.classList.remove("open");
  courseFolderError.textContent = "";
}

async function saveCourseFolder() {
  const name = courseFolderInput.value.trim();
  if (!name) {
    courseFolderError.textContent = "Indique un nom de dossier.";
    courseFolderInput.focus();
    return;
  }

  const isRename = courseFolderMode === "rename";
  if (isRename && name === courseFolderTarget) {
    closeCourseFolder();
    return;
  }
  const payload = new URLSearchParams(isRename
    ? {current_name:courseFolderTarget, new_name:name}
    : {name});
  saveCourseFolderBtn.disabled = true;
  courseFolderError.textContent = isRename ? "Renommage…" : "Création…";

  try {
    const controller = isRename ? "classpad_storage_rename-course" : "classpad_storage_create-course";
    const response = await fetch(`/?do=${controller}`, {
      method: "POST",
      headers: {"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
      body: payload.toString()
    });
    const data = await response.json();
    if (!response.ok || data?.errors) throw new Error("course_action_failed");

    closeCourseFolder();
    const savedName = typeof data.name === "string" ? data.name : name;
    const preferredCourse = isRename && course.value !== courseFolderTarget ? course.value : savedName;
    await loadCourses(preferredCourse);
    status.textContent = isRename ? "Dossier du cours renommé" : "Dossier du cours ajouté";
    status.className = "status-ok";
  } catch {
    courseFolderError.textContent = "Impossible d’enregistrer ce nom. Vérifie qu’il est valide et qu’il n’existe pas déjà.";
  } finally {
    saveCourseFolderBtn.disabled = false;
  }
}

addCourseBtn.addEventListener("click", () => openCourseFolder("create"));
course.addEventListener("click", () => setCourseListOpen(courseList.hidden));
renameCourseBtn.addEventListener("click", () => openCourseFolder("rename", activeCourseName));
document.addEventListener("mousedown", event => {
  const clickedPicker = event.target.closest(".course-picker");
  if (!courseList.hidden && !clickedPicker && !courseActionMenu.contains(event.target)) {
    setCourseListOpen(false);
  }
  if (!courseActionMenu.hidden && !courseActionMenu.contains(event.target) && event.target !== courseActionTrigger) {
    closeCourseActionMenu();
  }
});
courseList.addEventListener("scroll", () => closeCourseActionMenu(), {passive:true});
cancelCourseFolderBtn.addEventListener("click", closeCourseFolder);
saveCourseFolderBtn.addEventListener("click", saveCourseFolder);
courseFolderInput.addEventListener("keydown", event => {
  if (event.key === "Enter") saveCourseFolder();
});
courseFolderBackdrop.addEventListener("mousedown", event => {
  if (event.target === courseFolderBackdrop) closeCourseFolder();
});

async function loadStorageDrives() {
  const requestId = ++storageBrowserRequestId;
  storageParentPath = null;
  storageParentBtn.disabled = true;
  storageBrowserPath.textContent = "Ce PC";
  setStorageBrowserStatus("Chargement des lecteurs…");
  storageBrowserList.replaceChildren();

  try {
    const data = await fetchStorageData("classpad_storage_drives");
    if (requestId !== storageBrowserRequestId) return;
    const drives = Array.isArray(data.drives) ? data.drives : [];
    renderStorageEntries(drives);
    setStorageBrowserStatus(`${drives.length} lecteur${drives.length > 1 ? "s" : ""} disponible${drives.length > 1 ? "s" : ""}.`);
  } catch {
    if (requestId !== storageBrowserRequestId) return;
    renderStorageEntries([]);
    setStorageBrowserStatus("Impossible de récupérer les lecteurs du PC.", true);
  }
}

async function loadStorageDirectory(path) {
  if (!path) {
    await loadStorageDrives();
    return;
  }

  const requestId = ++storageBrowserRequestId;
  storageParentBtn.disabled = true;
  storageBrowserPath.textContent = path;
  setStorageBrowserStatus("Chargement du dossier…");
  storageBrowserList.replaceChildren();

  try {
    const params = {path, limit:"500"};
    const [directoryData, fileData] = await Promise.all([
      fetchStorageData("classpad_storage_directories", params),
      fetchStorageData("classpad_storage_files", params)
    ]);
    if (requestId !== storageBrowserRequestId) return;

    const basePath = typeof directoryData.base_path === "string" ? directoryData.base_path : path;
    const directories = Array.isArray(directoryData.directories) ? directoryData.directories : [];
    const files = Array.isArray(fileData.files) ? fileData.files : [];
    storageParentPath = typeof directoryData.parent_path === "string" ? directoryData.parent_path : null;
    storageParentBtn.disabled = !storageParentPath;
    storageBrowserPath.textContent = basePath;
    storageBrowserPath.title = basePath;
    storagePathInput.value = basePath;
    renderStorageEntries([...directories, ...files]);

    const shown = directories.length + files.length;
    const total = Number(directoryData.total || directories.length) + Number(fileData.total || files.length);
    setStorageBrowserStatus(total > shown
      ? `${shown} élément${shown > 1 ? "s" : ""} affiché${shown > 1 ? "s" : ""} sur ${total}.`
      : `${shown} élément${shown > 1 ? "s" : ""}.`);
  } catch {
    if (requestId !== storageBrowserRequestId) return;
    renderStorageEntries([]);
    setStorageBrowserStatus("Ce dossier est introuvable ou n’est pas accessible.", true);
  }
}

async function openStoragePath({initialPath = null, browseWhenEmpty = false} = {}) {
  setMenuOpen(false);
  storagePathInput.value = "";
  storagePathError.textContent = "Chargement…";
  setStorageBrowserOpen(false);
  storagePathBackdrop.classList.add("open");

  try {
    let path = initialPath;
    if (path === null) {
      const response = await fetch("/?get=classpad_storage_filesystem-path");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      path = typeof data.path === "string" ? data.path : "";
    }
    storagePathInput.value = path;
    storagePathError.textContent = "";
    if (browseWhenEmpty && !path) {
      setStorageBrowserOpen(true);
      await loadStorageDrives();
    }
  } catch {
    storagePathError.textContent = "Impossible de charger le chemin configuré.";
  }

  storagePathInput.focus();
}

function closeStoragePath() {
  storageBrowserRequestId++;
  setStorageBrowserOpen(false);
  storagePathBackdrop.classList.remove("open");
  storagePathError.textContent = "";
  editor.focus();
}

async function saveStoragePath() {
  const path = storagePathInput.value.trim();
  if (!path) {
    storagePathError.textContent = "Indique un chemin de dossier.";
    storagePathInput.focus();
    return;
  }

  saveStoragePathBtn.disabled = true;
  storagePathError.textContent = "Enregistrement…";
  try {
    const response = await fetch(`/?do=classpad_storage_save-filesystem-path&path=${encodeURIComponent(path)}`, {
      method: "POST"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    window.location.reload();
  } catch {
    storagePathError.textContent = "Impossible d’enregistrer le chemin.";
  } finally {
    saveStoragePathBtn.disabled = false;
  }
}

storagePathBtn.addEventListener("click", () => openStoragePath());
browseStoragePathBtn.addEventListener("click", async () => {
  const open = storageBrowser.hidden;
  setStorageBrowserOpen(open);
  if (!open) return;
  const path = storagePathInput.value.trim();
  if (path) await loadStorageDirectory(path);
  else await loadStorageDrives();
});
storageDrivesBtn.addEventListener("click", loadStorageDrives);
storageParentBtn.addEventListener("click", () => loadStorageDirectory(storageParentPath));
cancelStoragePathBtn.addEventListener("click", closeStoragePath);
saveStoragePathBtn.addEventListener("click", saveStoragePath);
storagePathInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveStoragePath();
});
storagePathBackdrop.addEventListener("mousedown", (event) => {
  if (event.target === storagePathBackdrop) closeStoragePath();
});

// ------------------------------------------------------------
// Rendu HTML de l'AST
// ------------------------------------------------------------
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function unwrapGroups(ast) {
  while (ast?.type === "group") ast = ast.expr;
  return ast;
}

function needsParentheses(ast, parentOp, side) {
  ast = unwrapGroups(ast);
  if (!ast || !parentOp) return false;

  // Une fraction et un exposant délimitent déjà visuellement leur contenu.
  if (parentOp === "/" || (parentOp === "^" && side === "right")) return false;

  if (parentOp === "^" && side === "left") {
    return ast.type === "unary" || (ast.type === "binary" && ast.op !== "/");
  }

  if (ast.type !== "binary") return false;
  if (ast.op === "=") return true;

  if (parentOp === "unary") {
    return ast.op === "+" || ast.op === "-";
  }

  if (parentOp === "*") {
    return ast.op === "+" || ast.op === "-";
  }

  if (parentOp === "-") {
    return side === "right" && (ast.op === "+" || ast.op === "-");
  }

  return false;
}

function renderAst(ast, parentOp = null, side = null) {
  if (!ast) return document.createTextNode("");

  ast = unwrapGroups(ast);
  let result;

  switch (ast.type) {
    case "number":
      result = el("span","mnum",ast.value);
      break;

    case "id":
      result = el("span","mvar",ast.name);
      break;

    case "unary": {
      const r = el("span","mrow");
      r.appendChild(el("span","mop",ast.op));
      r.appendChild(renderAst(ast.expr, "unary", "right"));
      result = r;
      break;
    }

    case "set": {
      const r = el("span","mrow");
      r.appendChild(document.createTextNode("{"));
      ast.elements.forEach((element, index) => {
        if (index) r.appendChild(document.createTextNode("; "));
        r.appendChild(renderAst(element));
      });
      r.appendChild(document.createTextNode("}"));
      result = r;
      break;
    }

    case "absolute": {
      const r = el("span","mrow");
      r.appendChild(document.createTextNode("|"));
      r.appendChild(renderAst(ast.expr));
      r.appendChild(document.createTextNode("|"));
      result = r;
      break;
    }

    case "call": {
      if (ast.name.toLowerCase() === "sqrt" && ast.args.length === 1) {
        const r = el("span","msqrt");
        const sign = el("span","sqrt-sign");
        sign.setAttribute("role", "img");
        sign.setAttribute("aria-label", "racine carrée");
        r.appendChild(sign);
        const body = el("span","sqrt-body");
        body.appendChild(renderAst(ast.args[0]));
        r.appendChild(body);
        result = r;
        break;
      }

      const r = el("span","mrow");
      r.appendChild(el("span","mfn-name",ast.name));
      r.appendChild(document.createTextNode("("));
      ast.args.forEach((arg, idx) => {
        if (idx) r.appendChild(document.createTextNode(", "));
        r.appendChild(renderAst(arg));
      });
      r.appendChild(document.createTextNode(")"));
      result = r;
      break;
    }

    case "binary": {
      if (ast.op === "/") {
        const f = el("span","mfrac");
        const num = el("span","num");
        const den = el("span","den");
        num.appendChild(renderAst(ast.left, "/", "left"));
        den.appendChild(renderAst(ast.right, "/", "right"));
        f.appendChild(num);
        f.appendChild(den);
        result = f;
        break;
      }

      if (ast.op === "^") {
        const p = el("span","mpow");
        p.appendChild(renderAst(ast.left, "^", "left"));
        const sup = document.createElement("sup");
        sup.appendChild(renderAst(ast.right, "^", "right"));
        p.appendChild(sup);
        result = p;
        break;
      }

      const r = el("span","mrow");
      r.appendChild(renderAst(ast.left, ast.op, "left"));
      const opMap = {"*":"·", "+":"+", "-":"−", "=":"="};
      r.appendChild(el("span","mop",opMap[ast.op] || ast.op));
      r.appendChild(renderAst(ast.right, ast.op, "right"));
      result = r;
      break;
    }

    default:
      result = document.createTextNode("?");
  }

  if (!needsParentheses(ast, parentOp, side)) return result;

  const group = el("span","mgroup");
  group.appendChild(result);
  return group;
}

function renderSource(src, target) {
  target.replaceChildren();
  try {
    const ast = parseMath(src);
    target.appendChild(renderAst(ast));
    return true;
  } catch (e) {
    target.textContent = src;
    return false;
  }
}

// ------------------------------------------------------------
// Markdown contextuel
// ------------------------------------------------------------
let markdownRendering = false;
let markdownDetectionCount = 0;
const MARKDOWN_DEBUG_PREFIX = "[ClassPad:Markdown]";

function markdownDebug(event, details = {}) {
  console.debug(MARKDOWN_DEBUG_PREFIX, event, details);
}

markdownDebug("Support Markdown initialise", {
  editorId: editor.id,
  contentEditable: editor.contentEditable
});

function marker(text) {
  return el("span", "md-marker", text);
}

function appendMarkdownToken(parent, type, opening, content, closing, start, end, extra) {
  const token = el("span", "md-token md-" + type);
  token.dataset.mdStart = String(start);
  token.dataset.mdEnd = String(end);
  token.dataset.source = opening + content + closing;
  token.appendChild(marker(opening));
  if (type === "link") {
    token.appendChild(document.createTextNode(content));
    token.appendChild(marker(closing));
    token.title = extra || "";
  } else {
    renderInlineMarkdown(content, token, start + opening.length);
    token.appendChild(marker(closing));
  }
  parent.appendChild(token);
}

function renderInlineMarkdown(source, target, baseOffset) {
  const patterns = [
    {type:"code", re:/`([^`\n]+)`/g, open:"`", close:"`"},
    {type:"strong", re:/\*\*([^*\n]+)\*\*/g, open:"**", close:"**"},
    {type:"strong", re:/__([^_\n]+)__/g, open:"__", close:"__"},
    {type:"strike", re:/~~([^~\n]+)~~/g, open:"~~", close:"~~"},
    {type:"link", re:/\[([^\]\n]+)\]\(([^)\n]+)\)/g, open:"[", close:null},
    {type:"em", re:/(?<!\*)\*([^*\n]+)\*(?!\*)/g, open:"*", close:"*"},
    {type:"em", re:/(?<!_)_([^_\n]+)_(?!_)/g, open:"_", close:"_"}
  ];
  let cursor = 0;
  while (cursor < source.length) {
    let best = null;
    for (const pattern of patterns) {
      pattern.re.lastIndex = cursor;
      const match = pattern.re.exec(source);
      if (match && (!best || match.index < best.match.index ||
          (match.index === best.match.index && match[0].length > best.match[0].length))) {
        best = {pattern, match};
      }
    }
    if (!best) {
      target.appendChild(document.createTextNode(source.slice(cursor)));
      break;
    }
    if (best.match.index > cursor) {
      target.appendChild(document.createTextNode(source.slice(cursor, best.match.index)));
    }
    const {pattern, match} = best;
    const start = baseOffset + match.index;
    const end = start + match[0].length;
    markdownDetectionCount++;
    markdownDebug("Syntaxe inline detectee", {
      type: pattern.type,
      start,
      end,
      openingMarker: pattern.open,
      closingMarker: pattern.type === "link" ? "](...)" : pattern.close
    });
    if (pattern.type === "link") {
      appendMarkdownToken(target, "link", "[", match[1], "](" + match[2] + ")", start, end, match[2]);
    } else {
      appendMarkdownToken(target, pattern.type, pattern.open, match[1], pattern.close, start, end);
    }
    cursor = match.index + match[0].length;
  }
}

function getEditorSnapshot() {
  const formulae = [];
  const lines = [];
  let caretOffset = null;
  const sel = window.getSelection();
  const range = sel.rangeCount && sel.isCollapsed ? sel.getRangeAt(0) : null;
  const caretNode = range?.startContainer || null;
  const caretNodeOffset = range?.startOffset || 0;
  let absoluteOffset = 0;

  function readNode(node) {
    if (node === caretNode && node.nodeType === Node.TEXT_NODE) caretOffset = absoluteOffset + caretNodeOffset;
    if (node.nodeType === Node.TEXT_NODE) {
      absoluteOffset += node.nodeValue.length;
      return node.nodeValue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.classList.contains("math-token")) {
      formulae.push(node.dataset.source || node.textContent || "");
      absoluteOffset++;
      return "\uFFFC";
    }
    if (node.tagName === "BR") {
      if (node.parentElement === editor) {
        absoluteOffset++;
        return "\n";
      }
      return "";
    }
    let text = "";
    Array.from(node.childNodes).forEach((child, index) => {
      if (node === caretNode && caretNodeOffset === index) caretOffset = absoluteOffset;
      text += readNode(child);
    });
    if (node === caretNode && caretNodeOffset === node.childNodes.length) caretOffset = absoluteOffset;
    return text;
  }

  const children = Array.from(editor.childNodes);
  const hasLineBlocks = children.some(node => node.nodeType === Node.ELEMENT_NODE &&
    (node.classList.contains("md-line") || node.tagName === "DIV" || node.tagName === "P"));
  if (hasLineBlocks) {
    children.forEach((node, index) => {
      if (index) absoluteOffset++;
      if (caretNode === editor && caretNodeOffset === index) caretOffset = absoluteOffset;
      lines.push(readNode(node));
    });
    if (caretNode === editor && caretNodeOffset === children.length) caretOffset = absoluteOffset;
  } else {
    lines.push(readNode(editor));
  }
  return {source:lines.join("\n"), formulae, caretOffset};
}

function renderMarkdown(source, formulae, caretOffset) {
  markdownRendering = true;
  markdownDetectionCount = 0;
  markdownDebug("Debut du rendu", {
    sourceLength: source.length,
    formulaCount: formulae.length,
    caretOffset
  });
  const fragment = document.createDocumentFragment();
  let formulaIndex = 0;
  let lineStart = 0;
  source.split("\n").forEach(rawLine => {
    const line = el("div", "md-line");
    line.dataset.mdStart = String(lineStart);
    line.dataset.mdEnd = String(lineStart + rawLine.length);
    let content = rawLine;
    let contentOffset = lineStart;
    let match;
    if ((match = rawLine.match(/^(#{1,6})\s+(.*)$/))) {
      markdownDetectionCount++;
      markdownDebug("Syntaxe de bloc detectee", {type:"heading", level:match[1].length, start:lineStart});
      line.classList.add("md-heading-" + match[1].length);
      line.appendChild(marker(match[1] + " "));
      content = match[2]; contentOffset += match[1].length + 1;
    } else if ((match = rawLine.match(/^(>)\s+(.*)$/))) {
      markdownDetectionCount++;
      markdownDebug("Syntaxe de bloc detectee", {type:"quote", start:lineStart});
      line.classList.add("md-quote"); line.appendChild(marker("> "));
      content = match[2]; contentOffset += 2;
    } else if ((match = rawLine.match(/^([-+*])\s+(.*)$/))) {
      markdownDetectionCount++;
      markdownDebug("Syntaxe de bloc detectee", {type:"unordered-list", marker:match[1], start:lineStart});
      line.classList.add("md-list", "md-unordered"); line.appendChild(marker(match[1] + " "));
      content = match[2]; contentOffset += 2;
    } else if ((match = rawLine.match(/^(\d+)\.\s+(.*)$/))) {
      markdownDetectionCount++;
      markdownDebug("Syntaxe de bloc detectee", {type:"ordered-list", number:match[1], start:lineStart});
      line.classList.add("md-list", "md-ordered"); line.dataset.listNumber = match[1];
      line.appendChild(marker(match[1] + ". "));
      content = match[2]; contentOffset += match[1].length + 2;
    }
    const parts = content.split("\uFFFC");
    let partOffset = contentOffset;
    parts.forEach((part, index) => {
      renderInlineMarkdown(part, line, partOffset);
      partOffset += part.length;
      if (index < parts.length - 1) {
        line.appendChild(createMathToken(formulae[formulaIndex++] || "?"));
        partOffset++;
      }
    });
    if (!line.childNodes.length) line.appendChild(document.createElement("br"));
    fragment.appendChild(line);
    lineStart += rawLine.length + 1;
  });
  editor.replaceChildren(fragment);
  // Rendre d'abord visibles les marqueurs susceptibles de recevoir le
  // curseur. Les navigateurs déplacent un Range posé dans display:none.
  updateActiveMarkdown(caretOffset);
  setCaretFromSourceOffset(caretOffset);
  markdownRendering = false;
  markdownDebug("Rendu termine", {
    detectionCount: markdownDetectionCount,
    renderedLineCount: editor.querySelectorAll(".md-line").length
  });
}

function setCaretFromSourceOffset(offset) {
  if (offset === null || offset === undefined) return;
  const requestedOffset = offset;
  const sel = window.getSelection();
  const range = document.createRange();
  let placed = false;

  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (offset <= node.nodeValue.length) {
        range.setStart(node, Math.max(0, offset)); placed = true; return true;
      }
      offset -= node.nodeValue.length;
      return false;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node.classList.contains("math-token")) {
      if (offset <= 0) {
        range.setStartBefore(node);
        placed = true;
        return true;
      }
      offset--;
      if (offset === 0) {
        range.setStartAfter(node);
        placed = true;
        return true;
      }
      return false;
    }
    for (const child of node.childNodes) if (visit(child)) return true;
    return false;
  }

  // Une ligne vide ne contient qu'un <br>, qui n'offre aucun nœud texte où
  // poser le Range. Cibler d'abord la ligne correspondant à l'offset évite
  // donc de traverser toutes les lignes vides jusqu'au prochain texte.
  const lines = Array.from(editor.children).filter(line => line.classList.contains("md-line"));
  const targetLine = lines.find(line => {
    const start = Number(line.dataset.mdStart);
    const end = Number(line.dataset.mdEnd);
    return requestedOffset >= start && requestedOffset <= end;
  });

  if (targetLine) {
    const lineStart = Number(targetLine.dataset.mdStart);
    const lineEnd = Number(targetLine.dataset.mdEnd);
    offset = Math.max(0, Math.min(requestedOffset - lineStart, lineEnd - lineStart));
    if (lineStart === lineEnd) {
      range.setStart(targetLine, 0);
      placed = true;
    } else {
      visit(targetLine);
    }
  } else {
    // Repli pour un contenu qui n'aurait pas encore été normalisé en lignes.
    offset = requestedOffset;
    visit(editor);
  }

  if (!placed) { range.selectNodeContents(editor); range.collapse(false); }
  else range.collapse(true);
  sel.removeAllRanges(); sel.addRange(range);
  markdownDebug("Curseur restaure", {
    requestedOffset,
    placed,
    containerType: range.startContainer.nodeType === Node.TEXT_NODE ? "text" : range.startContainer.nodeName,
    containerOffset: range.startOffset
  });
}

function updateActiveMarkdown(caretOffset) {
  editor.querySelectorAll(".md-active").forEach(node => node.classList.remove("md-active"));
  if (caretOffset === null || caretOffset === undefined) return;
  editor.querySelectorAll("[data-md-start][data-md-end]").forEach(node => {
    const start = Number(node.dataset.mdStart);
    const end = Number(node.dataset.mdEnd);
    if (caretOffset >= start && caretOffset <= end) node.classList.add("md-active");
  });
}

function refreshMarkdown() {
  if (markdownRendering) {
    markdownDebug("Rafraichissement ignore : rendu deja en cours");
    return;
  }
  const snapshot = getEditorSnapshot();
  markdownDebug("Rafraichissement demande", {
    sourceLength: snapshot.source.length,
    formulaCount: snapshot.formulae.length,
    caretOffset: snapshot.caretOffset
  });
  renderMarkdown(snapshot.source, snapshot.formulae, snapshot.caretOffset);
}

// ------------------------------------------------------------
// Import / export Markdown manuel
// ------------------------------------------------------------
function normalizeMarkdownEnd(markdown) {
  return String(markdown ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n+$/, "\n");
}

function exportToMarkdown() {
  const snapshot = getEditorSnapshot();
  let formulaIndex = 0;
  const source = snapshot.source.replace(/\uFFFC/g, () => snapshot.formulae[formulaIndex++] || "");
  return normalizeMarkdownEnd(source);
}

function importFromMarkdown(markdown) {
  const source = normalizeMarkdownEnd(markdown);
  const imported = identifyImportedFormulae(source);
  renderMarkdown(imported.source, imported.formulae, imported.source.length);
  scheduleSave();
  const count = imported.formulae.length;
  status.textContent = count
    ? `Contenu Markdown importé — ${count} formule${count > 1 ? "s" : ""} reconnue${count > 1 ? "s" : ""}`
    : "Contenu Markdown importé";
  status.className = "status-ok";
}

function openMarkdownTransfer() {
  setMenuOpen(false);
  markdownTransferInput.value = exportToMarkdown();
  markdownTransferBackdrop.classList.add("open");
  setTimeout(() => {
    markdownTransferInput.focus();
    markdownTransferInput.select();
  }, 0);
}

function closeMarkdownTransfer() {
  markdownTransferBackdrop.classList.remove("open");
  editor.focus();
}

markdownTransferBtn.addEventListener("click", openMarkdownTransfer);
printDocumentBtn.addEventListener("click", () => window.print());
cancelMarkdownTransferBtn.addEventListener("click", closeMarkdownTransfer);
importMarkdownBtn.addEventListener("click", () => {
  importFromMarkdown(markdownTransferInput.value);
  closeMarkdownTransfer();
});
copyMarkdownBtn.addEventListener("click", async () => {
  markdownTransferInput.focus();
  markdownTransferInput.select();
  try {
    await navigator.clipboard.writeText(markdownTransferInput.value);
    status.textContent = "Markdown copié dans le presse-papiers";
    status.className = "status-ok";
  } catch {
    status.textContent = "Texte sélectionné : utilise Ctrl+C pour le copier";
    status.className = "status-warn";
  }
});
markdownTransferBackdrop.addEventListener("mousedown", (e) => {
  if (e.target === markdownTransferBackdrop) closeMarkdownTransfer();
});

// ------------------------------------------------------------
// Détection de formule
// ------------------------------------------------------------
function createMathToken(source) {
  const span = document.createElement("span");
  span.className = "math-token";
  span.contentEditable = "false";
  span.dataset.source = source;
  span.title = source + " — double-cliquer pour modifier";
  renderSource(source, span);
  return span;
}

function convertTrailingToken(boundaryKey) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return false;

  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const offset = range.startOffset;

  if (node.nodeType !== Node.TEXT_NODE) return false;

  const before = node.nodeValue.slice(0, offset);
  const match = before.match(/(\S+)$/);
  if (!match) return false;

  let raw = match[1];
  let punctuation = "";

  // Conserve ponctuation finale non mathématique.
  const punctMatch = raw.match(/([,;:.!?]+)$/);
  if (punctMatch) {
    punctuation = punctMatch[1];
    raw = raw.slice(0, -punctuation.length);
  }

  if (!isLikelyMath(raw)) return false;

  const start = offset - match[1].length;
  const parent = node.parentNode;

  const leftText = node.nodeValue.slice(0, start);
  const rightText = node.nodeValue.slice(offset);

  const left = document.createTextNode(leftText);
  const math = createMathToken(raw);
  const punct = document.createTextNode(punctuation);
  const right = document.createTextNode(rightText);

  parent.insertBefore(left, node);
  parent.insertBefore(math, node);
  if (punctuation) parent.insertBefore(punct, node);
  parent.insertBefore(right, node);
  parent.removeChild(node);

  // Replace caret after inserted expression.
  const newRange = document.createRange();
  newRange.setStart(right, 0);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);

  status.textContent = "Formule reconnue : " + raw;
  status.className = "status-ok";
  scheduleSave();
  return true;
}

// Return an insertion plan only when the closing parenthesis needs an opener.
function planClosingParenthesis(source, caret, formulaOnly = false) {
  const before = source.slice(0, caret);
  // Never cross a line or an already rendered formula.
  const segmentStart = Math.max(before.lastIndexOf("\n"), before.lastIndexOf("\uFFFC")) + 1;
  const segment = before.slice(segmentStart);
  let depth = 0;
  for (const char of segment) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (depth < 0) return null;
  }
  if (depth !== 0) return null;

  const starts = formulaOnly
    ? [segment.search(/\S/)]
    : Array.from(segment.matchAll(/[^\s\u2192:!?]+/g), match => match.index);
  for (const start of starts) {
    if (start < 0) continue;
    const expression = segment.slice(start);
    if (!formulaOnly && !isLikelyMath(expression)) continue;
    try {
      parseMath(expression);
    } catch {
      continue;
    }
    const openingOffset = segmentStart + start;
    return {
      source: source.slice(0, openingOffset) + "(" + source.slice(openingOffset, caret) + ")" + source.slice(caret),
      caretOffset: caret + 2
    };
  }
  return null;
}

function isClosingParenthesisInput(event) {
  return event.cancelable && !event.isComposing &&
    event.inputType === "insertText" && event.data === ")";
}

editor.addEventListener("beforeinput", event => {
  if (!isClosingParenthesisInput(event) || markdownComposing) return;
  const snapshot = getEditorSnapshot();
  if (snapshot.caretOffset === null) return;
  const plan = planClosingParenthesis(snapshot.source, snapshot.caretOffset);
  if (!plan) return;
  event.preventDefault();
  renderMarkdown(plan.source, snapshot.formulae, plan.caretOffset);
  scheduleSave();
});

formulaInput.addEventListener("beforeinput", event => {
  if (!isClosingParenthesisInput(event)) return;
  const start = formulaInput.selectionStart;
  if (start === null || start !== formulaInput.selectionEnd) return;
  const plan = planClosingParenthesis(formulaInput.value, start, true);
  if (!plan) return;
  event.preventDefault();
  formulaInput.value = plan.source;
  formulaInput.setSelectionRange(plan.caretOffset, plan.caretOffset);
  formulaInput.dispatchEvent(new Event("input", {bubbles:true}));
});

editor.addEventListener("keydown", (e) => {
  if ((e.key === " " || e.key === "Enter") && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const converted = convertTrailingToken(e.key);
    if (converted) {
      e.preventDefault();
      document.execCommand("insertText", false, e.key === " " ? " " : "\n");
      return;
    }
  }

  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const snapshot = getEditorSnapshot();
    if (snapshot.caretOffset !== null) {
      e.preventDefault();
      const offset = snapshot.caretOffset;
      const source = snapshot.source.slice(0, offset) + "\n" + snapshot.source.slice(offset);
      renderMarkdown(source, snapshot.formulae, offset + 1);
      scheduleSave();
      return;
    }
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "m") {
    e.preventDefault();
    convertSelectionToMath();
  }
});

document.addEventListener("selectionchange", () => {
  const sel = window.getSelection();
  if (!sel.rangeCount || !editor.contains(sel.anchorNode)) return;
  updateActiveMarkdown(getEditorSnapshot().caretOffset);
});

function convertSelectionToMath() {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) {
    status.textContent = "Sélectionne d'abord une expression";
    status.className = "status-warn";
    return;
  }

  const text = sel.toString().trim();
  if (!text) return;

  try {
    parseMath(text);
  } catch (e) {
    status.textContent = "La sélection n'est pas une expression valide";
    status.className = "status-warn";
    return;
  }

  const range = sel.getRangeAt(0);
  range.deleteContents();
  const token = createMathToken(text);
  range.insertNode(token);
  range.setStartAfter(token);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);

  status.textContent = "Sélection convertie en formule";
  status.className = "status-ok";
  scheduleSave();
}

// ------------------------------------------------------------
// Éditeur de formule
// ------------------------------------------------------------
editor.addEventListener("dblclick", (e) => {
  const token = e.target.closest?.(".math-token");
  if (!token) return;
  openFormulaEditor(token);
});

function openFormulaEditor(token) {
  editingToken = token;
  formulaInput.value = token.dataset.source || token.textContent;
  modalBackdrop.classList.add("open");
  updatePreview();
  setTimeout(() => {
    formulaInput.focus();
    formulaInput.select();
  }, 0);
}

function closeFormulaEditor() {
  editingToken = null;
  modalBackdrop.classList.remove("open");
}

function fitFormulaPreview() {
  const content = formulaPreview.firstElementChild;
  if (!content || !formulaPreview.clientWidth) return;
  const style = getComputedStyle(formulaPreview);
  const availableWidth = formulaPreview.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  let lower = 14;
  let upper = 28;
  content.style.fontSize = upper + "px";
  if (content.getBoundingClientRect().width <= availableWidth) return;
  // Measure the rendered expression, including fractions and fixed-width borders.
  for (let i = 0; i < 8; i++) {
    const size = (lower + upper) / 2;
    content.style.fontSize = size + "px";
    if (content.getBoundingClientRect().width <= availableWidth) lower = size;
    else upper = size;
  }
  content.style.fontSize = lower + "px";
}

let previewWidth = 0;
const previewResizeObserver = new ResizeObserver(entries => {
  const width = entries[0].contentRect.width;
  if (width === previewWidth) return;
  previewWidth = width;
  fitFormulaPreview();
});
previewResizeObserver.observe(formulaPreview);

function updatePreview() {
  const src = formulaInput.value.trim();
  formulaPreview.replaceChildren();
  formulaError.textContent = "";

  if (!src) {
    formulaError.textContent = "La formule est vide.";
    return false;
  }

  try {
    const ast = parseMath(src);
    const content = el("div", "preview-content");
    content.appendChild(renderAst(ast));
    formulaPreview.appendChild(content);
    fitFormulaPreview();
    return true;
  } catch (e) {
    formulaPreview.appendChild(el("div", "preview-content", src));
    fitFormulaPreview();
    formulaError.textContent = e.message;
    return false;
  }
}

formulaInput.addEventListener("input", updatePreview);

document.querySelectorAll("[data-wrap]").forEach(btn => {
  btn.addEventListener("click", () => {
    const src = formulaInput.value.trim() || "x";
    switch (btn.dataset.wrap) {
      case "paren":
        formulaInput.value = "(" + src + ")";
        break;
      case "square":
        formulaInput.value = "(" + src + ")^2";
        break;
      case "sqrt":
        formulaInput.value = "sqrt(" + src + ")";
        break;
      case "reciprocal":
        formulaInput.value = "1/(" + src + ")";
        break;
      case "cubeRoot":
        formulaInput.value = "(" + src + ")^(1/3)";
        break;
    }
    updatePreview();
    formulaInput.focus();
  });
});

saveBtn.addEventListener("click", () => {
  if (!editingToken) return;
  const src = formulaInput.value.trim();
  if (!updatePreview()) return;

  editingToken.dataset.source = src;
  editingToken.title = src + " — double-cliquer pour modifier";
  renderSource(src, editingToken);
  scheduleSave();
  closeFormulaEditor();
});

toTextBtn.addEventListener("click", () => {
  if (!editingToken) return;
  const text = document.createTextNode(formulaInput.value.trim());
  editingToken.replaceWith(text);
  scheduleSave();
  closeFormulaEditor();
});

cancelBtn.addEventListener("click", closeFormulaEditor);

modalBackdrop.addEventListener("mousedown", (e) => {
  if (e.target === modalBackdrop) closeFormulaEditor();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !fileActionMenu.hidden) {
    closeFileActionMenu(true);
  } else if (e.key === "Escape" && !courseActionMenu.hidden) {
    closeCourseActionMenu(true);
  } else if (e.key === "Escape" && !courseList.hidden) {
    setCourseListOpen(false);
    course.focus();
  } else if (e.key === "Escape" && fileActionBackdrop.classList.contains("open")) {
    closeFileAction();
  } else if (e.key === "Escape" && courseFolderBackdrop.classList.contains("open")) {
    closeCourseFolder();
  } else if (e.key === "Escape" && storagePathBackdrop.classList.contains("open")) {
    closeStoragePath();
  } else if (e.key === "Escape" && markdownTransferBackdrop.classList.contains("open")) {
    closeMarkdownTransfer();
  } else if (e.key === "Escape" && modalBackdrop.classList.contains("open")) {
    closeFormulaEditor();
  } else if (e.key === "Escape" && !mainMenu.hidden) {
    setMenuOpen(false);
    menuBtn.focus();
  }
});

// ------------------------------------------------------------
// Sauvegarde automatique sur le système de fichiers
// ------------------------------------------------------------
function formatLocalDateTime(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const pad = value => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    + `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function waitForSaveIdle() {
  if (!saveInProgress) return Promise.resolve();
  return new Promise(resolve => saveIdleResolvers.push(resolve));
}

function notifySaveIdle() {
  if (saveInProgress || savePending) return;
  saveIdleResolvers.splice(0).forEach(resolve => resolve());
}

async function doSave(targetCourse = padCourse || course.value, refreshFiles = true) {
  if (saveInProgress) {
    savePending = true;
    return;
  }

  const savedCourse = targetCourse;
  const subject = title.value.trim();
  if (!subject) {
    status.textContent = "Indique un sujet pour activer la sauvegarde";
    status.className = "status-warn";
    return;
  }
  if (!savedCourse || course.disabled) {
    status.textContent = "Ajoute un dossier de cours pour activer la sauvegarde";
    status.className = "status-warn";
    return;
  }

  saveInProgress = true;
  status.textContent = "Sauvegarde…";
  status.className = "status-warn";

  const savedAt = new Date();
  const savedDraft = activeDraft;
  const savedPad = loadedPad?.course === savedCourse ? loadedPad : null;
  const payload = new URLSearchParams({
    course: savedCourse,
    subject,
    date_time: formatLocalDateTime(savedAt),
    markdown: exportToMarkdown()
  });
  if (savedPad) payload.set("filename", savedPad.filename);

  try {
    const response = await fetch("/?do=classpad_storage_save-pad", {
      method: "POST",
      headers: {"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
      body: payload.toString()
    });
    const data = await response.json();
    if (!response.ok || data?.errors) throw new Error(`HTTP ${response.status}`);

    if (!savedPad && typeof data.filename === "string") {
      loadedPad = createLoadedPadReference(savedCourse, data.filename);
      if (title.value.trim() !== subject) scheduleTitleRename();
    }

    clearDraft(savedDraft);
    if (activeDraft && course.value === savedCourse) persistDraft();

    if (refreshFiles && course.value === savedCourse) {
      if (!savePending) {
        status.textContent = "Sauvegardé sur le disque";
        status.className = "status-ok";
      }
      loadCourseFiles();
    }
  } catch {
    if (course.value === savedCourse) {
      status.textContent = "Impossible de sauvegarder sur le disque";
      status.className = "status-warn";
    }
  } finally {
    saveInProgress = false;
    if (savePending) {
      savePending = false;
      doSave().then(notifySaveIdle, notifySaveIdle);
    } else {
      notifySaveIdle();
    }
  }
}

function scheduleSave() {
  persistDraft();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    doSave();
  }, 350);
}

function subjectFilename(filename, subject) {
  let safeSubject = subject
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[ .-]+|[ .-]+$/g, "");
  while (new TextEncoder().encode(safeSubject).length > 180) {
    safeSubject = safeSubject.slice(0, -1);
  }
  if (!safeSubject) return "";

  const datePrefix = filename.match(/^(\d{4}-\d{2}-\d{2}\s+-\s+)/)?.[1] || "";
  return `${datePrefix}${safeSubject}.md`;
}

async function renamePadSubject(padReference, subject) {
  const newFilename = subjectFilename(padReference.filename, subject);
  if (!newFilename || newFilename === padReference.filename) return;

  if (loadedPad === padReference) {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
      await doSave(padReference.course, false);
    }
    await waitForSaveIdle();
  }

  const payload = new URLSearchParams({
    operation:"rename",
    course:padReference.course,
    filename:padReference.filename,
    new_name:newFilename
  });

  try {
    const response = await fetch("/?do=classpad_storage_manage-file", {
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
      body:payload.toString()
    });
    const data = await response.json();
    if (!response.ok || data?.errors || typeof data.filename !== "string") {
      throw new Error("title_rename_failed");
    }

    padReference.filename = data.filename;
    padReference.path = `${padReference.course}/${data.filename}`;
    if (loadedPad === padReference && activeDraft) persistDraft();
    if (course.value === padReference.course) await loadCourseFiles();
    if (loadedPad === padReference) {
      status.textContent = "Sujet et fichier renommés";
      status.className = "status-ok";
    }
  } catch {
    if (loadedPad === padReference) {
      status.textContent = "Impossible de renommer le fichier";
      status.className = "status-warn";
    }
  }
}

function scheduleTitleRename() {
  if (activeDraft) persistDraft();
  clearTimeout(titleRenameTimer);
  if (!loadedPad) {
    scheduleSave();
    return;
  }

  const padReference = loadedPad;
  titleRenameTimer = setTimeout(() => {
    titleRenameTimer = null;
    const subject = title.value.trim();
    if (!subject) {
      status.textContent = "Le sujet ne peut pas être vide";
      status.className = "status-warn";
      return;
    }
    titleRenameQueue = titleRenameQueue
      .then(() => renamePadSubject(padReference, subject))
      .catch(() => {});
  }, 600);
}

editor.addEventListener("compositionstart", () => {
  markdownComposing = true;
});
editor.addEventListener("compositionend", () => {
  markdownComposing = false;
  refreshMarkdown();
  scheduleSave();
});
editor.addEventListener("input", () => {
  if (!markdownComposing) refreshMarkdown();
  scheduleSave();
});
course.addEventListener("change", async () => {
  const requestId = ++courseChangeRequestId;
  const previousCourse = padCourse;
  const nextCourse = course.value;
  padContentRequestId++;
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  savePending = false;

  await waitForSaveIdle();
  if (requestId !== courseChangeRequestId) return;
  await doSave(previousCourse, false);
  if (requestId !== courseChangeRequestId) return;

  padCourse = nextCourse;
  activeDraft = null;
  loadedPad = null;
  title.value = "";
  renderMarkdown("", [], 0);
  loadCourseFiles();
  status.textContent = "Nouveau document";
  status.className = "";
  editor.focus();
});
newCourseFileBtn.addEventListener("click", () => openFileAction("create"));
refreshCourseFilesBtn.addEventListener("click", loadCourseFiles);
title.addEventListener("input", scheduleTitleRename);
loadCourses(restoreDraft() || getSuggestedCourseFromTime());
})();
