(() => {
  // executeScript may run this file repeatedly; install one message listener only.
  if (globalThis.__pageFileDownloaderScannerInstalled) return;
  globalThis.__pageFileDownloaderScannerInstalled = true;

  const SCAN_REQUEST = "page-file-downloader:scan";
  const extensionToCategory = {
    pdf: "pdf",
    png: "images",
    jpg: "images",
    jpeg: "images",
    gif: "images",
    webp: "images",
    svg: "images",
    doc: "docs",
    docx: "docs",
    txt: "docs",
    rtf: "docs",
    odt: "docs",
    xls: "docs",
    xlsx: "docs",
    ppt: "docs",
    pptx: "docs",
    mp3: "media",
    wav: "media",
    flac: "media",
    aac: "media",
    m4a: "media",
    ogg: "media",
    oga: "media",
    opus: "media",
    wma: "media",
    mp4: "media",
    m4v: "media",
    mov: "media",
    avi: "media",
    mkv: "media",
    webm: "media",
    wmv: "media",
    flv: "media",
    mpeg: "media",
    mpg: "media",
    "3gp": "media",
    ogv: "media"
  };

  function categoryForUrl(url) {
    const match = url.pathname.match(/\.([a-z0-9]+)$/i);
    return match ? extensionToCategory[match[1].toLowerCase()] || null : null;
  }

  function scanPageLinks() {
    const uniqueLinks = new Map();

    for (const anchor of document.querySelectorAll("a[href]")) {
      let url;
      try {
        url = new URL(anchor.getAttribute("href"), document.baseURI);
      } catch {
        continue;
      }

      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      const category = categoryForUrl(url);
      if (!category) continue;

      uniqueLinks.set(url.href, { url: url.href, category });
    }

    return [...uniqueLinks.values()];
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== SCAN_REQUEST) return;

    try {
      sendResponse({ ok: true, links: scanPageLinks() });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || "Could not scan this page." });
    }
  });
})();
