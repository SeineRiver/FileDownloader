import { formatUrlManifest, urlManifestFilename } from "./url-manifest.js";

export async function exportUrlManifest({ urls, destination, duplicateHandling }) {
  const objectUrl = URL.createObjectURL(new Blob([formatUrlManifest(urls)], { type: "text/plain;charset=utf-8" }));
  const filename = urlManifestFilename();
  const downloadFilename = destination.mode === "subfolder" && destination.subfolder ? `${destination.subfolder}/${filename}` : filename;
  try {
    await chrome.downloads.download({ url: objectUrl, filename: downloadFilename, saveAs: destination.mode === "ask", conflictAction: duplicateHandling });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
