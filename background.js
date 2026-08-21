const DOWNLOAD_REQUEST = "page-file-downloader:download";
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

  Promise.all(
    urls.map(async (url) => {
      try {
        const options = {
          url,
          conflictAction: duplicateHandling,
          saveAs: destination.mode === "ask"
        };
        if (destination.mode === "subfolder") {
          const filename = sourceFilename(url);
          if (filename) {
            options.filename = destination.subfolder
              ? `${destination.subfolder}/${filename}`
              : filename;
          }
        }
        await chrome.downloads.download(options);
        return { url, ok: true };
      } catch (error) {
        return { url, ok: false, error: error?.message || "Download was rejected." };
      }
    })
  ).then((results) => {
    const failures = results.filter((result) => !result.ok);
    sendResponse({
      ok: true,
      attempted: results.length,
      succeeded: results.length - failures.length,
      failed: failures.length,
      errors: failures.slice(0, 3).map((failure) => failure.error)
    });
  }).catch((error) => {
    sendResponse({ ok: false, error: error?.message || "Could not start downloads." });
  });

  return true;
});
