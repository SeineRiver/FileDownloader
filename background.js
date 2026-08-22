const DOWNLOAD_REQUEST = "page-file-downloader:download";
const QUEUE_KEY = "pageFileDownloaderQueue";
const DOWNLOAD_COUNT_KEY = "downloadedFileCount";
let queue = null;
const VALID_LIMITS = new Set([1, 3, 5, "all"]);
const DEFAULT_DUPLICATE_HANDLING = "uniquify";
const DUPLICATE_HANDLING = new Set(["uniquify", "prompt", "overwrite"]);

function normalizeDuplicateHandling(value) {
  return DUPLICATE_HANDLING.has(value) ? value : DEFAULT_DUPLICATE_HANDLING;
}

function validHttpUrl(value) {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

function validateDestination(destination) {
  if (!destination || typeof destination !== "object") {
    return { ok: false, error: "A download destination is required." };
  }
  if (destination.mode === "default" || destination.mode === "ask") {
    return { ok: true, mode: destination.mode, subfolder: "" };
  }
  if (destination.mode !== "subfolder") {
    return { ok: false, error: "The selected download destination is invalid." };
  }

  const subfolder = validateSubfolder(destination.subfolder);
  return subfolder.ok
    ? { ok: true, mode: "subfolder", subfolder: subfolder.value }
    : subfolder;
}

function sourceFilename(urlString) {
  try {
    const pathname = new URL(urlString).pathname;
    const encodedName = pathname.slice(pathname.lastIndexOf("/") + 1);
    const name = decodeURIComponent(encodedName);
    if (!name || name === "." || name === "..") return null;
    return name.replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_");
  } catch {
    return null;
  }
}

async function saveQueue() { if (queue) await chrome.storage.session.set({ [QUEUE_KEY]: queue }); else await chrome.storage.session.remove(QUEUE_KEY); }
async function recordCompletion(item) { if (item.counted) return; item.counted = true; const local = await chrome.storage.local.get(DOWNLOAD_COUNT_KEY); const saved = Object.hasOwn(local, DOWNLOAD_COUNT_KEY) ? local : await chrome.storage.sync.get(DOWNLOAD_COUNT_KEY); const previous = Number.isSafeInteger(saved[DOWNLOAD_COUNT_KEY]) && saved[DOWNLOAD_COUNT_KEY] >= 0 ? saved[DOWNLOAD_COUNT_KEY] : 0; const count = previous + 1; await chrome.storage.local.set({ [DOWNLOAD_COUNT_KEY]: count }); chrome.storage.sync.set({ [DOWNLOAD_COUNT_KEY]: count }).catch(() => {}); chrome.runtime.sendMessage({ type: "page-file-downloader:download-count", count }).catch(() => {}); }
function queueStatus() { if (!queue) return null; const active = queue.items.filter((item) => item.status === "active").length; const queued = queue.items.filter((item) => item.status === "queued").length; const done = queue.items.filter((item) => item.status === "complete" || item.status === "failed").length; return { text: done === queue.items.length ? `${done} downloads finished.` : `Downloading ${done + active} of ${queue.items.length} — ${active} active, ${queued} queued` }; }
function notifyQueue() { const status = queueStatus(); if (status) chrome.runtime.sendMessage({ type: "page-file-downloader:queue-status", statusText: status.text }).catch(() => {}); }
async function scheduleQueue() { if (!queue) return; const limit = queue.limit === "all" ? queue.items.length : queue.limit; while (queue.items.filter((item) => item.status === "active").length < limit) { const item = queue.items.find((entry) => entry.status === "queued"); if (!item) break; item.status = "active"; try { const options = { url: item.url, conflictAction: queue.duplicateHandling, saveAs: queue.destination.mode === "ask" }; if (queue.destination.mode === "subfolder") { const filename = sourceFilename(item.url); if (filename) options.filename = queue.destination.subfolder ? `${queue.destination.subfolder}/${filename}` : filename; } item.downloadId = await chrome.downloads.download(options); } catch (error) { item.status = "failed"; item.error = error?.message || "Download was rejected."; } } await saveQueue(); notifyQueue(); if (queue.items.every((item) => item.status === "complete" || item.status === "failed")) { queue = null; await saveQueue(); } }
chrome.downloads.onChanged.addListener(async (delta) => { if (!queue || !delta.state || !["complete", "interrupted"].includes(delta.state.current)) return; const item = queue.items.find((entry) => entry.downloadId === delta.id); if (!item) return; item.status = delta.state.current === "complete" ? "complete" : "failed"; if (item.status === "complete") await recordCompletion(item); await scheduleQueue(); });
async function restoreQueue() { const saved = await chrome.storage.session.get(QUEUE_KEY); queue = saved[QUEUE_KEY] || queue; if (!queue) return; for (const item of queue.items.filter((entry) => entry.status === "active" && entry.downloadId)) { const [download] = await chrome.downloads.search({ id: item.downloadId }); if (!download || download.state === "complete") { item.status = "complete"; await recordCompletion(item); } else if (download.state === "interrupted") item.status = "failed"; } await scheduleQueue(); }

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== DOWNLOAD_REQUEST) return;

  const requestedUrls = message.urls;
  if (!Array.isArray(requestedUrls)) {
    sendResponse({ ok: false, error: "The download request did not contain a URL list." });
    return;
  }

  const urls = [...new Set(requestedUrls.filter(validHttpUrl))];
  if (urls.length === 0) {
    sendResponse({ ok: false, error: "No valid HTTP(S) download URLs were supplied." });
    return;
  }

  const destination = validateDestination(message.destination);
  if (!destination.ok) {
    sendResponse({ ok: false, error: destination.error });
    return;
  }
  const duplicateHandling = normalizeDuplicateHandling(message.duplicateHandling);

  const requestedLimit = VALID_LIMITS.has(message.concurrentDownloadLimit) ? message.concurrentDownloadLimit : 3;
  queue = { items: urls.map((url) => ({ url, status: "queued" })), destination, duplicateHandling, limit: destination.mode === "ask" || duplicateHandling === "prompt" ? 1 : requestedLimit };
  saveQueue().then(scheduleQueue).then(() => sendResponse({ ok: true, statusText: queueStatus()?.text || "Download queue started." })).catch((error) => sendResponse({ ok: false, error: error?.message || "Could not start downloads." }));

  return true;
});
restoreQueue().catch(() => {});
