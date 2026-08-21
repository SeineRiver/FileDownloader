export function formatUrlManifest(urls) { return urls.join("\n"); }

export function urlManifestFilename(date = new Date()) {
  const localDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  return `page-file-downloader-links-${localDate}.txt`;
}
