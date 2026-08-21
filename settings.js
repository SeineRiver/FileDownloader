export const CATEGORIES = ["pdf", "images", "docs", "media"];
export const BUILTIN_EXTENSIONS = Object.freeze({
  pdf: [".pdf"], images: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
  docs: [".doc", ".docx", ".txt", ".rtf", ".odt", ".xls", ".xlsx", ".ppt", ".pptx"],
  media: [".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg", ".oga", ".opus", ".wma", ".mp4", ".m4v", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv", ".mpeg", ".mpg", ".3gp", ".ogv"]
});
export const DEFAULT_SETTINGS = Object.freeze({ destination: Object.freeze({ mode: "default", subfolder: "" }), duplicateHandling: "uniquify" });
export const MAX_CUSTOM_CATEGORIES = 10;
export const MAX_EXTENSIONS_PER_CATEGORY = 20;
export const CUSTOM_CATEGORY_ICONS = Object.freeze(["🏷", "📦", "🗂", "🧩", "🔖", "🛠", "📊", "💾", "🧪", "🎨"]);
const DUPLICATE_HANDLING = new Set(["uniquify", "prompt", "overwrite"]);
const BUILTIN_EXTENSION_OWNERS = new Map(Object.entries(BUILTIN_EXTENSIONS).flatMap(([category, extensions]) => extensions.map((extension) => [extension, category])));

export function categoryKey(category) { return category.id ? `custom:${category.id}` : category; }
export function validateSubfolder(value) { if (typeof value !== "string") return { ok: false, error: "The subfolder must be text." }; const trimmed = value.trim(); if (!trimmed) return { ok: true, value: "" }; if (/^[\\/]/.test(trimmed) || /^~/.test(trimmed) || /^[A-Za-z]:[\\/]/.test(trimmed)) return { ok: false, error: "Use a path relative to Chrome's Downloads folder." }; const segments = trimmed.replace(/\\/g, "/").split("/"); if (segments.some((segment) => !segment || segment === "." || segment === "..")) return { ok: false, error: "Subfolders cannot contain empty segments, . or ..." }; if (segments.some((segment) => /[<>:"|?*\u0000-\u001F]/.test(segment))) return { ok: false, error: "The subfolder contains invalid filename characters." }; return { ok: true, value: segments.join("/") }; }
export function normalizeExtension(token) { if (typeof token !== "string") return null; const bare = token.trim().toLowerCase().replace(/^\.+/, ""); if (!bare || /[\\/?#:\s]/.test(token) || !/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)*$/.test(bare)) return null; return `.${bare}`; }
export function parseExtensions(value) { if (typeof value !== "string" || !value.trim()) return { ok: false, error: "Enter at least one extension." }; if (/(^|,)\s*(?=,|$)/.test(value)) return { ok: false, error: "Extensions cannot contain empty entries." }; const extensions = [...new Set(value.trim().split(/[\s,]+/).map(normalizeExtension))]; if (extensions.includes(null)) return { ok: false, error: "Extensions must be simple suffixes such as .zip or .tar.gz." }; if (extensions.length > MAX_EXTENSIONS_PER_CATEGORY) return { ok: false, error: `Use no more than ${MAX_EXTENSIONS_PER_CATEGORY} extensions.` }; return { ok: true, value: extensions }; }
export function validateCustomCategory(draft, categories = [], editingId = null) {
  const name = typeof draft?.name === "string" ? draft.name.trim() : "";
  if (!name) return { ok: false, error: "Category name is required." };
  if (name.length > 32) return { ok: false, error: "Category names can be at most 32 characters." };
  const matchingName = categories.find((category) => category.id !== editingId && category.name.toLowerCase() === name.toLowerCase());
  if (matchingName) return { ok: false, error: `A category named “${matchingName.name}” already exists.` };
  const parsed = parseExtensions(draft?.extensions);
  if (!parsed.ok) return parsed;
  const customExtensions = categories.filter((category) => category.id !== editingId).flatMap((category) => category.extensions.map((extension) => [extension, category.name]));
  for (const extension of parsed.value) {
    const builtinConflict = [...BUILTIN_EXTENSION_OWNERS.entries()].find(([other]) => extension.endsWith(other) || other.endsWith(extension));
    if (builtinConflict) return { ok: false, error: `${extension} conflicts with ${builtinConflict[0]} in the built-in ${builtinConflict[1].toUpperCase()} category.` };
    const customConflict = customExtensions.find(([other]) => extension.endsWith(other) || other.endsWith(extension));
    if (customConflict) return { ok: false, error: `${extension} is already assigned to “${customConflict[1]}”.` };
  }
  return { ok: true, value: { name, extensions: parsed.value } };
}
export function createCategoryId() { return globalThis.crypto?.randomUUID?.() || `category-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
export function randomCustomCategoryIcon(categories = []) { const used = new Set(categories.map((category) => category.icon)); const choices = CUSTOM_CATEGORY_ICONS.filter((icon) => !used.has(icon)); const pool = choices.length ? choices : CUSTOM_CATEGORY_ICONS; return pool[Math.floor(Math.random() * pool.length)]; }
export function normalizeCustomCategories(value) { if (!Array.isArray(value)) return []; const categories = []; for (const candidate of value) { if (categories.length >= MAX_CUSTOM_CATEGORIES || typeof candidate?.id !== "string" || !candidate.id.trim()) continue; const draft = { ...candidate, extensions: Array.isArray(candidate.extensions) ? candidate.extensions.join(",") : candidate.extensions }; const validation = validateCustomCategory(draft, categories); if (validation.ok) categories.push({ id: candidate.id, icon: CUSTOM_CATEGORY_ICONS.includes(candidate.icon) ? candidate.icon : randomCustomCategoryIcon(categories), ...validation.value }); } return categories; }
export function normalizeSettings(saved = {}) { const duplicateHandling = DUPLICATE_HANDLING.has(saved.duplicateHandling) ? saved.duplicateHandling : DEFAULT_SETTINGS.duplicateHandling; const mode = ["default", "ask", "subfolder"].includes(saved.destination?.mode) ? saved.destination.mode : DEFAULT_SETTINGS.destination.mode; const subfolder = validateSubfolder(saved.destination?.subfolder); return { destination: { mode, subfolder: subfolder.ok ? subfolder.value : "" }, duplicateHandling }; }
export function normalizeSelectedFileTypes(savedTypes) { return Object.fromEntries(CATEGORIES.map((category) => [category, savedTypes?.[category] !== false])); }
export function normalizeCustomSelections(value, categories) { return Object.fromEntries(categories.map((category) => [category.id, value?.[category.id] !== false])); }
export async function loadSettings() { const saved = await chrome.storage.local.get(["destination", "duplicateHandling", "selectedFileTypes", "customCategories", "customCategorySelections"]); const customCategories = normalizeCustomCategories(saved.customCategories); return { settings: normalizeSettings(saved), selectedFileTypes: normalizeSelectedFileTypes(saved.selectedFileTypes), customCategories, customCategorySelections: normalizeCustomSelections(saved.customCategorySelections, customCategories) }; }
export function saveSettings(settings) { return chrome.storage.local.set({ destination: settings.destination, duplicateHandling: settings.duplicateHandling }); }
export function saveSelectedFileTypes(selectedFileTypes) { return chrome.storage.local.set({ selectedFileTypes }); }
export function saveCustomCategories(customCategories, customCategorySelections) { return chrome.storage.local.set({ customCategories, customCategorySelections }); }
export function destinationLabel(destination) { if (destination.mode === "ask") return "Ask for each file"; if (destination.mode === "subfolder") return `Downloads/${destination.subfolder || ""}`.replace(/\/$/, ""); return "Chrome default Downloads folder"; }
export function duplicateHandlingLabel(value) { return { uniquify: "Keep both", prompt: "Ask me", overwrite: "Replace existing" }[value] || "Keep both"; }
export function duplicateHandlingHelp(value) { return { uniquify: "Chrome creates a distinct filename, such as file (1).pdf.", prompt: "Chrome asks only when a filename conflict occurs.", overwrite: "Potentially destructive: matching target filenames may be replaced." }[value] || "Chrome creates a distinct filename, such as file (1).pdf."; }
