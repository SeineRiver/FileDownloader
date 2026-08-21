(() => {
  if (globalThis.__pageFileDownloaderScannerInstalled) return;
  globalThis.__pageFileDownloaderScannerInstalled = true;

  const SCAN_REQUEST = "page-file-downloader:scan";
  const builtinExtensions = {
    ".pdf": "pdf", ".png": "images", ".jpg": "images", ".jpeg": "images", ".gif": "images", ".webp": "images", ".svg": "images", ".doc": "docs", ".docx": "docs", ".txt": "docs", ".rtf": "docs", ".odt": "docs", ".xls": "docs", ".xlsx": "docs", ".ppt": "docs", ".pptx": "docs", ".mp3": "media", ".wav": "media", ".flac": "media", ".aac": "media", ".m4a": "media", ".ogg": "media", ".oga": "media", ".opus": "media", ".wma": "media", ".mp4": "media", ".m4v": "media", ".mov": "media", ".avi": "media", ".mkv": "media", ".webm": "media", ".wmv": "media", ".flv": "media", ".mpeg": "media", ".mpg": "media", ".3gp": "media", ".ogv": "media"
  };
  const mediaExtensions = Object.entries(builtinExtensions).filter(([, category]) => category === "media").map(([extension]) => extension);

  function scanCategories(customCategories) {
    const custom = Array.isArray(customCategories) ? customCategories.flatMap((category) => typeof category?.id === "string" && Array.isArray(category.extensions) ? category.extensions.filter((extension) => typeof extension === "string" && /^\.[a-z0-9][a-z0-9.-]*$/.test(extension)).map((extension) => [extension, `custom:${category.id}`]) : []) : [];
    return [...Object.entries(builtinExtensions), ...custom].sort(([left], [right]) => right.length - left.length);
  }
  function normalizeCandidateUrl(value) {
    try { const url = new URL(value, document.baseURI); return url.protocol === "http:" || url.protocol === "https:" ? url : null; } catch { return null; }
  }
  function extensionMatches(url, extensions) { const pathname = url.pathname.toLowerCase(); return extensions.some((extension) => pathname.endsWith(extension)); }
  function categoryForUrl(url, categories) { const pathname = url.pathname.toLowerCase(); const match = categories.find(([extension]) => pathname.endsWith(extension)); return match?.[1] || null; }
  function isStreamingManifest(url) { return /\.(m3u8|mpd)$/i.test(url.pathname); }
  function isDirectMediaCandidate(url, type) { return !isStreamingManifest(url) && (extensionMatches(url, mediaExtensions) || /^(audio|video)\//i.test(type || "")); }
  function collectAnchorCandidates() { return [...document.querySelectorAll("a[href]")].map((element) => ({ value: element.getAttribute("href"), type: "", embedded: false })); }
  function collectEmbeddedMediaCandidates() {
    const candidates = [];
    for (const element of document.querySelectorAll("audio[src], video[src], audio source[src], video source[src]")) candidates.push({ value: element.getAttribute("src"), type: element.getAttribute("type"), embedded: true });
    for (const element of document.querySelectorAll("source[src]")) {
      if (element.closest("audio, video, picture")) continue;
      candidates.push({ value: element.getAttribute("src"), type: element.getAttribute("type"), embedded: true });
    }
    return candidates;
  }
  function classifyCandidate(candidate, categories) {
    const url = normalizeCandidateUrl(candidate.value);
    if (!url) return null;
    const category = candidate.embedded ? (isDirectMediaCandidate(url, candidate.type) ? "media" : null) : categoryForUrl(url, categories);
    return category ? { url: url.href, category } : null;
  }
  function scanPageLinks(customCategories) {
    const uniqueLinks = new Map(), categories = scanCategories(customCategories);
    for (const candidate of [...collectAnchorCandidates(), ...collectEmbeddedMediaCandidates()]) { const match = classifyCandidate(candidate, categories); if (match) uniqueLinks.set(match.url, match); }
    return [...uniqueLinks.values()];
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => { if (message?.type !== SCAN_REQUEST) return; try { sendResponse({ ok: true, links: scanPageLinks(message.customCategories) }); } catch (error) { sendResponse({ ok: false, error: error?.message || "Could not scan this page." }); } });
})();
