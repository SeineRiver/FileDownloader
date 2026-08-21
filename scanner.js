(() => {
  if (globalThis.__pageFileDownloaderScannerInstalled) return;
  globalThis.__pageFileDownloaderScannerInstalled = true;
  const SCAN_REQUEST = "page-file-downloader:scan";
  const builtinExtensions = {
    ".pdf": "pdf", ".png": "images", ".jpg": "images", ".jpeg": "images", ".gif": "images", ".webp": "images", ".svg": "images", ".doc": "docs", ".docx": "docs", ".txt": "docs", ".rtf": "docs", ".odt": "docs", ".xls": "docs", ".xlsx": "docs", ".ppt": "docs", ".pptx": "docs", ".mp3": "media", ".wav": "media", ".flac": "media", ".aac": "media", ".m4a": "media", ".ogg": "media", ".oga": "media", ".opus": "media", ".wma": "media", ".mp4": "media", ".m4v": "media", ".mov": "media", ".avi": "media", ".mkv": "media", ".webm": "media", ".wmv": "media", ".flv": "media", ".mpeg": "media", ".mpg": "media", ".3gp": "media", ".ogv": "media"
  };
  function scanCategories(customCategories) { const custom = Array.isArray(customCategories) ? customCategories.flatMap((category) => typeof category?.id === "string" && Array.isArray(category.extensions) ? category.extensions.filter((extension) => typeof extension === "string" && /^\.[a-z0-9][a-z0-9.-]*$/.test(extension)).map((extension) => [extension, `custom:${category.id}`]) : []) : []; return [...Object.entries(builtinExtensions), ...custom].sort(([left], [right]) => right.length - left.length); }
  function categoryForUrl(url, categories) { const pathname = url.pathname.toLowerCase(); const match = categories.find(([extension]) => pathname.endsWith(extension)); return match?.[1] || null; }
  function scanPageLinks(customCategories) { const uniqueLinks = new Map(); const categories = scanCategories(customCategories); for (const anchor of document.querySelectorAll("a[href]")) { let url; try { url = new URL(anchor.getAttribute("href"), document.baseURI); } catch { continue; } if (url.protocol !== "http:" && url.protocol !== "https:") continue; const category = categoryForUrl(url, categories); if (category) uniqueLinks.set(url.href, { url: url.href, category }); } return [...uniqueLinks.values()]; }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => { if (message?.type !== SCAN_REQUEST) return; try { sendResponse({ ok: true, links: scanPageLinks(message.customCategories) }); } catch (error) { sendResponse({ ok: false, error: error?.message || "Could not scan this page." }); } });
})();
