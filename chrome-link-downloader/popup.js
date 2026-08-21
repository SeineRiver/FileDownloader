const SCAN_REQUEST = "page-file-downloader:scan";
const DOWNLOAD_REQUEST = "page-file-downloader:download";
const categories = ["pdf", "images", "docs", "media"];
const enabledCategories = new Set(categories);
const DEFAULT_DESTINATION = { mode: "default", subfolder: "" };
const DEFAULT_DUPLICATE_HANDLING = "uniquify";
const DUPLICATE_HANDLING = new Set(["uniquify", "prompt", "overwrite"]);

let currentLinks = [];
let activeTabId = null;
let scanInProgress = null;
let destination = { ...DEFAULT_DESTINATION };
let pendingDestination = { ...DEFAULT_DESTINATION };
let locationTrigger = null;
let duplicateHandling = DEFAULT_DUPLICATE_HANDLING;
let overwriteDialogTrigger = null;

const elements = {
  pageStatus: document.querySelector("#page-status"),
  total: document.querySelector("#selection-total"),
  empty: document.querySelector("#empty-state"),
  result: document.querySelector("#result-status"),
  rescan: document.querySelector("#rescan-button"),
  download: document.querySelector("#download-button"),
  destinationLabel: document.querySelector("#destination-label"),
  destinationPath: document.querySelector("#destination-path"),
  destinationHelp: document.querySelector("#destination-help"),
  destinationSeparator: document.querySelector(".destination-separator"),
  duplicateHandling: document.querySelector("#duplicate-handling-select"),
  duplicateHandlingHelp: document.querySelector("#duplicate-handling-help"),
  duplicateSummary: document.querySelector("#duplicate-summary"),
  chooseLocation: document.querySelector("#choose-location-button"),
  openDownloads: document.querySelector("#open-downloads-button"),
  destinationDialog: document.querySelector("#destination-dialog"),
  closeLocation: document.querySelector("#close-location-button"),
  cancelLocation: document.querySelector("#cancel-location-button"),
  saveLocation: document.querySelector("#save-location-button"),
  destinationModes: [...document.querySelectorAll('input[name="destination-mode"]')],
  subfolderField: document.querySelector("#subfolder-field"),
  subfolder: document.querySelector("#subfolder-input"),
  subfolderError: document.querySelector("#subfolder-error"),
  overwriteDialog: document.querySelector("#overwrite-dialog"),
  cancelOverwrite: document.querySelector("#cancel-overwrite-button"),
  continueOverwrite: document.querySelector("#continue-overwrite-button"),
  toggles: [...document.querySelectorAll(".category-toggle")]
};

function normalizeDuplicateHandling(value) {
  return DUPLICATE_HANDLING.has(value) ? value : DEFAULT_DUPLICATE_HANDLING;
}

function duplicateHandlingLabel(value = duplicateHandling) {
  return {
    uniquify: "Keep both",
    prompt: "Ask me",
    overwrite: "Replace existing (may overwrite files)"
  }[normalizeDuplicateHandling(value)];
}

function duplicateHandlingHelp(value = duplicateHandling) {
  return {
    uniquify: "Chrome creates a distinct filename, such as file (1).pdf.",
    prompt: "Chrome asks only when a filename conflict occurs.",
    overwrite: "Potentially destructive: matching target filenames may be replaced."
  }[normalizeDuplicateHandling(value)];
}

function selectedLinks() {
  return currentLinks.filter((link) => enabledCategories.has(link.category));
}

function restoreSelectedFileTypes(savedTypes) {
  enabledCategories.clear();
  categories.forEach((category) => {
    if (savedTypes?.[category] !== false) enabledCategories.add(category);
  });
}

function selectedFileTypes() {
  return Object.fromEntries(
    categories.map((category) => [category, enabledCategories.has(category)])
  );
}

async function persistSelectedFileTypes() {
  try {
    await chrome.storage.local.set({ selectedFileTypes: selectedFileTypes() });
  } catch {
    // Keep the current popup selection if storage is temporarily unavailable.
  }
}

function setResult(message = "", isError = false) {
  elements.result.textContent = message;
  elements.result.classList.toggle("error", isError);
}

function validateSubfolder(value) {
  if (typeof value !== "string") return { ok: false, error: "The subfolder must be text." };

  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: "" };
  if (/^[\\/]/.test(trimmed) || /^~/.test(trimmed) || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    return { ok: false, error: "Use a path relative to Chrome's Downloads folder." };
  }

  const normalized = trimmed.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return { ok: false, error: "Subfolders cannot contain empty segments, . or ..." };
  }
  if (segments.some((segment) => /[<>:"|?*\u0000-\u001F]/.test(segment))) {
    return { ok: false, error: "The subfolder contains invalid filename characters." };
  }

  return { ok: true, value: segments.join("/") };
}

function renderDestination() {
  elements.destinationPath.textContent = "";
  elements.destinationPath.hidden = true;

  if (destination.mode === "ask") {
    elements.destinationLabel.textContent = "Ask me for each file";
    elements.destinationHelp.textContent = "Chrome will show one Save As dialog for each file.";
    elements.destinationSeparator.hidden = false;
  } else if (destination.mode === "subfolder") {
    elements.destinationLabel.textContent = "Downloads subfolder";
    elements.destinationPath.textContent = destination.subfolder || "Downloads";
    elements.destinationPath.hidden = false;
    elements.destinationHelp.textContent = "";
    elements.destinationSeparator.hidden = true;
  } else {
    elements.destinationLabel.textContent = "Chrome default Downloads folder";
    elements.destinationHelp.textContent = "Usually ~/Downloads; configured in Chrome";
    elements.destinationSeparator.hidden = false;
  }

  duplicateHandling = normalizeDuplicateHandling(duplicateHandling);
  elements.duplicateHandling.value = duplicateHandling;
  elements.duplicateHandlingHelp.textContent = duplicateHandlingHelp();
  elements.duplicateSummary.textContent = `If filename already exists: ${duplicateHandlingLabel()}`;
}

async function persistDuplicateHandling() {
  try {
    await chrome.storage.local.set({ duplicateHandling });
  } catch {
    setResult("Could not save the filename-conflict setting.", true);
  }
}

function renderDestinationDialog() {
  elements.destinationModes.forEach((input) => {
    input.checked = input.value === pendingDestination.mode;
  });
  const usingSubfolder = pendingDestination.mode === "subfolder";
  elements.subfolderField.hidden = !usingSubfolder;
  elements.subfolder.value = pendingDestination.subfolder;

  const validation = usingSubfolder
    ? validateSubfolder(pendingDestination.subfolder)
    : { ok: true };
  elements.subfolder.setAttribute("aria-invalid", String(!validation.ok));
  elements.subfolderError.textContent = validation.ok ? "" : validation.error;
  elements.subfolderError.hidden = validation.ok;
  elements.saveLocation.disabled = !validation.ok;
}

function openDestinationDialog() {
  locationTrigger = document.activeElement;
  pendingDestination = { ...destination };
  renderDestinationDialog();
  elements.destinationDialog.hidden = false;
  elements.chooseLocation.setAttribute("aria-expanded", "true");
  const focusTarget = pendingDestination.mode === "subfolder"
    ? elements.subfolder
    : elements.destinationModes.find((input) => input.checked);
  focusTarget.focus();
}

function closeDestinationDialog() {
  elements.destinationDialog.hidden = true;
  elements.chooseLocation.setAttribute("aria-expanded", "false");
  (locationTrigger || elements.chooseLocation).focus();
}

async function saveDestination() {
  const validation = pendingDestination.mode === "subfolder"
    ? validateSubfolder(pendingDestination.subfolder)
    : { ok: true, value: "" };
  const rememberedSubfolder = validateSubfolder(pendingDestination.subfolder);
  if (!validation.ok) {
    renderDestinationDialog();
    return;
  }

  destination = {
    mode: pendingDestination.mode,
    subfolder: rememberedSubfolder.ok ? rememberedSubfolder.value : ""
  };
  await chrome.storage.local.set({ destination });
  renderDestination();
  closeDestinationDialog();
  setResult("Save location updated.");
}

function render() {
  const counts = Object.fromEntries(categories.map((category) => [category, 0]));
  currentLinks.forEach((link) => { counts[link.category] += 1; });

  categories.forEach((category) => {
    document.querySelector(`[data-count="${category}"]`).textContent = counts[category];
  });
  elements.toggles.forEach((button) => {
    button.setAttribute("aria-pressed", String(enabledCategories.has(button.dataset.category)));
  });

  const total = selectedLinks().length;
  elements.total.textContent = `${total} selected file${total === 1 ? "" : "s"}`;
  elements.download.textContent = `Download ${total} file${total === 1 ? "" : "s"}`;
  elements.download.disabled = total === 0 || activeTabId === null;
  elements.empty.hidden = currentLinks.length > 0 || activeTabId === null;
}

function apiError(error, fallback) {
  return error?.message || fallback;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active browser tab is available.");
  return tab;
}

function scanCurrentTab({ announce = false, force = false } = {}) {
  if (scanInProgress) {
    return force
      ? scanInProgress.then(() => scanCurrentTab({ announce }))
      : scanInProgress;
  }

  scanInProgress = (async () => {
    try {
      const tab = await getActiveTab();
      activeTabId = tab.id;
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["scanner.js"] });
      const response = await chrome.tabs.sendMessage(tab.id, { type: SCAN_REQUEST });

      if (!response?.ok || !Array.isArray(response.links)) {
        throw new Error(response?.error || "The page scanner did not return links.");
      }

      currentLinks = response.links.filter(
        (link) => typeof link?.url === "string" && categories.includes(link.category)
      );
      elements.pageStatus.textContent = `Found ${currentLinks.length} supported link${currentLinks.length === 1 ? "" : "s"}.`;
      if (announce) setResult("Scan updated.");
    } catch (error) {
      activeTabId = null;
      currentLinks = [];
      elements.pageStatus.textContent = "This page cannot be scanned.";
      setResult(`${apiError(error, "Chrome blocked access to this page.")} Try a normal web page.`, true);
    } finally {
      scanInProgress = null;
      render();
    }
  })();

  return scanInProgress;
}

async function downloadSelected() {
  setResult("");
  elements.download.disabled = true;
  elements.pageStatus.textContent = "Refreshing links before download…";

  await scanCurrentTab({ force: true });
  const urls = selectedLinks().map((link) => link.url);
  if (urls.length === 0) {
    setResult("No selected file links are available to download.", true);
    render();
    return;
  }

  if (destination.mode === "ask" && urls.length > 1) {
    const confirmed = window.confirm(
      `Chrome will open ${urls.length} Save As dialogs, one for each file. Continue?`
    );
    if (!confirmed) {
      setResult("Download canceled.");
      render();
      return;
    }
  }

  if (duplicateHandling === "overwrite") {
    const confirmed = await confirmOverwrite();
    if (!confirmed) {
      setResult("Download canceled.");
      render();
      return;
    }
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: DOWNLOAD_REQUEST,
      urls,
      destination: { ...destination },
      duplicateHandling
    });
    if (!response?.ok) throw new Error(response?.error || "The download request failed.");

    if (response.failed) {
      const detail = response.errors?.[0] ? ` ${response.errors[0]}` : "";
      setResult(`${response.succeeded} started; ${response.failed} failed.${detail}`, true);
    } else {
      setResult(`${response.succeeded} download${response.succeeded === 1 ? "" : "s"} started.`);
    }
  } catch (error) {
    setResult(apiError(error, "Could not start downloads."), true);
  } finally {
    render();
  }
}

function confirmOverwrite() {
  return new Promise((resolve) => {
    overwriteDialogTrigger = document.activeElement;
    const close = (confirmed) => {
      elements.overwriteDialog.hidden = true;
      elements.cancelOverwrite.removeEventListener("click", cancel);
      elements.continueOverwrite.removeEventListener("click", continueDownload);
      elements.overwriteDialog.removeEventListener("keydown", onKeydown);
      (overwriteDialogTrigger || elements.download).focus();
      resolve(confirmed);
    };
    const cancel = () => close(false);
    const continueDownload = () => close(true);
    const onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      }
    };

    elements.cancelOverwrite.addEventListener("click", cancel);
    elements.continueOverwrite.addEventListener("click", continueDownload);
    elements.overwriteDialog.addEventListener("keydown", onKeydown);
    elements.overwriteDialog.hidden = false;
    elements.cancelOverwrite.focus();
  });
}

elements.toggles.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;
    if (enabledCategories.has(category)) enabledCategories.delete(category);
    else enabledCategories.add(category);
    setResult("");
    render();
    void persistSelectedFileTypes();
  });
});

elements.rescan.addEventListener("click", () => scanCurrentTab({ announce: true }));
elements.download.addEventListener("click", downloadSelected);
elements.chooseLocation.addEventListener("click", openDestinationDialog);
elements.closeLocation.addEventListener("click", closeDestinationDialog);
elements.cancelLocation.addEventListener("click", closeDestinationDialog);
elements.destinationModes.forEach((input) => {
  input.addEventListener("change", () => {
    pendingDestination.mode = input.value;
    renderDestinationDialog();
    if (input.value === "subfolder") elements.subfolder.focus();
  });
});
elements.subfolder.addEventListener("input", () => {
  pendingDestination.subfolder = elements.subfolder.value;
  renderDestinationDialog();
});
elements.saveLocation.addEventListener("click", async () => {
  try {
    await saveDestination();
  } catch (error) {
    setResult(apiError(error, "Could not save the location setting."), true);
  }
});
elements.destinationDialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeDestinationDialog();
  }
});
elements.openDownloads.addEventListener("click", async () => {
  try {
    await chrome.downloads.showDefaultFolder();
    if (destination.mode === "subfolder" && destination.subfolder) {
      setResult("Chrome can open the Downloads folder, but not a specific subfolder.", true);
    } else {
      setResult("Opened Chrome's Downloads folder.");
    }
  } catch (error) {
    setResult(apiError(error, "Could not open Chrome's Downloads folder."), true);
  }
});
elements.duplicateHandling.addEventListener("change", () => {
  duplicateHandling = normalizeDuplicateHandling(elements.duplicateHandling.value);
  renderDestination();
  void persistDuplicateHandling();
});

async function initialize() {
  try {
    const saved = await chrome.storage.local.get(["destination", "selectedFileTypes", "duplicateHandling"]);
    restoreSelectedFileTypes(saved.selectedFileTypes);
    duplicateHandling = normalizeDuplicateHandling(saved.duplicateHandling);
    if (saved.destination?.mode === "default" || saved.destination?.mode === "ask") {
      const validation = validateSubfolder(saved.destination.subfolder);
      destination = {
        mode: saved.destination.mode,
        subfolder: validation.ok ? validation.value : ""
      };
    } else if (saved.destination?.mode === "subfolder") {
      const validation = validateSubfolder(saved.destination.subfolder);
      if (validation.ok) destination = { mode: "subfolder", subfolder: validation.value };
    }
  } catch {
    // Use the default destination if storage is temporarily unavailable.
  }
  renderDestination();
  render();
  document.body.classList.remove("is-loading");
  scanCurrentTab();
}

initialize();
window.setInterval(() => scanCurrentTab(), 1000);
