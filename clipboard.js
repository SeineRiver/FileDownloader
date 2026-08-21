import { formatUrlManifest } from "./url-manifest.js";

export async function copyUrlManifest(urls) {
  const text = formatUrlManifest(urls);
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  const fallback = document.createElement("textarea");
  fallback.value = text; fallback.setAttribute("aria-hidden", "true"); fallback.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
  document.body.append(fallback); fallback.select();
  try { if (!document.execCommand("copy")) throw new Error("Clipboard write was rejected."); } finally { fallback.remove(); }
}
