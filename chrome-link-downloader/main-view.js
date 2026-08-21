import { CATEGORIES, destinationLabel, duplicateHandlingLabel } from "./settings.js";

export class MainView {
  constructor({ onCategoryToggle, onRescan, onDownload, onOpenConfiguration }) {
    this.root = document.querySelector("#main-view");
    this.pageStatus = document.querySelector("#page-status");
    this.total = document.querySelector("#selection-total");
    this.empty = document.querySelector("#empty-state");
    this.result = document.querySelector("#result-status");
    this.download = document.querySelector("#download-button");
    this.destination = document.querySelector("#current-destination");
    this.duplicate = document.querySelector("#current-duplicate");
    this.toggles = [...document.querySelectorAll(".category-toggle")];
    this.toggles.forEach((button) => button.addEventListener("click", () => onCategoryToggle(button.dataset.category)));
    document.querySelector("#rescan-button").addEventListener("click", onRescan);
    this.download.addEventListener("click", onDownload);
    ["#open-configuration-button", "#edit-settings-button"].forEach((selector) => document.querySelector(selector).addEventListener("click", onOpenConfiguration));
  }

  show() { this.root.hidden = false; }
  hide() { this.root.hidden = true; }
  setStatus(message = "", isError = false) { this.result.textContent = message; this.result.classList.toggle("error", isError); }
  setPageStatus(message) { this.pageStatus.textContent = message; }

  render({ links, selectedCategories, activeTabId, settings }) {
    const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
    links.forEach((link) => { counts[link.category] += 1; });
    CATEGORIES.forEach((category) => { document.querySelector(`[data-count="${category}"]`).textContent = counts[category]; });
    this.toggles.forEach((button) => button.setAttribute("aria-pressed", String(selectedCategories.has(button.dataset.category))));
    const total = links.filter((link) => selectedCategories.has(link.category)).length;
    this.total.textContent = `${total} selected file${total === 1 ? "" : "s"}`;
    this.download.textContent = `Download ${total} file${total === 1 ? "" : "s"}`;
    this.download.disabled = total === 0 || activeTabId === null;
    this.empty.hidden = links.length > 0 || activeTabId === null;
    this.destination.textContent = `Save location: ${destinationLabel(settings.destination)}`;
    this.duplicate.textContent = `If filename exists: ${duplicateHandlingLabel(settings.duplicateHandling)}`;
  }
}
