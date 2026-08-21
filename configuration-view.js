import { duplicateHandlingHelp, validateSubfolder } from "./settings.js";
import { CustomCategoriesView } from "./custom-categories-view.js";

export class ConfigurationView {
  constructor({ onBack, onSettingsChange, onCustomCategoriesChange, onOpenDownloads, onError }) {
    this.root = document.querySelector("#configuration-view");
    this.back = document.querySelector("#back-button");
    this.modes = [...document.querySelectorAll('input[name="destination-mode"]')];
    this.subfolderField = document.querySelector("#subfolder-field");
    this.subfolder = document.querySelector("#subfolder-input");
    this.subfolderError = document.querySelector("#subfolder-error");
    this.duplicate = document.querySelector("#duplicate-handling-select");
    this.duplicateHelp = document.querySelector("#duplicate-handling-help");
    this.concurrency = [...document.querySelectorAll('input[name="concurrent-download-limit"]')];
    this.settings = null;
    this.customCategoriesView = new CustomCategoriesView({ onChange: onCustomCategoriesChange, onError });
    this.back.addEventListener("click", onBack);
    document.querySelector("#open-downloads-button").addEventListener("click", onOpenDownloads);
    this.modes.forEach((input) => input.addEventListener("change", () => this.changeDestination(input.value, onSettingsChange, onError)));
    this.subfolder.addEventListener("input", () => { this.settings.destination.subfolder = this.subfolder.value; this.render(this.settings, true); });
    this.subfolder.addEventListener("change", () => this.saveSubfolder(onSettingsChange, onError));
    this.duplicate.addEventListener("change", () => this.changeDuplicateHandling(onSettingsChange, onError));
    this.concurrency.forEach((input) => input.addEventListener("change", async () => { this.settings.concurrentDownloadLimit = input.value === "all" ? "all" : Number(input.value); this.render(this.settings); try { await onSettingsChange(this.settings); } catch (error) { onError(error); } }));
  }

  show(settings, customCategories) { this.root.hidden = false; this.render(settings, false, customCategories); this.back.focus(); }
  hide() { this.root.hidden = true; }
  async changeDestination(mode, onSettingsChange, onError) {
    this.settings.destination.mode = mode;
    const subfolder = validateSubfolder(this.settings.destination.subfolder);
    this.settings.destination.subfolder = subfolder.ok ? subfolder.value : "";
    this.render(this.settings);
    try { await onSettingsChange(this.settings); } catch (error) { onError(error); }
    if (mode === "subfolder") this.subfolder.focus();
  }
  async saveSubfolder(onSettingsChange, onError) {
    const validation = validateSubfolder(this.subfolder.value);
    if (!validation.ok) return;
    this.settings.destination.subfolder = validation.value;
    this.render(this.settings);
    try { await onSettingsChange(this.settings); } catch (error) { onError(error); }
  }
  async changeDuplicateHandling(onSettingsChange, onError) {
    this.settings.duplicateHandling = this.duplicate.value;
    this.render(this.settings);
    try { await onSettingsChange(this.settings); } catch (error) { onError(error); }
  }
  render(settings, preserveInput = false, customCategories = null) {
    this.settings = { destination: { ...settings.destination }, duplicateHandling: settings.duplicateHandling, concurrentDownloadLimit: settings.concurrentDownloadLimit };
    this.modes.forEach((input) => { input.checked = input.value === this.settings.destination.mode; });
    const subfolderActive = this.settings.destination.mode === "subfolder";
    this.subfolderField.hidden = !subfolderActive;
    if (!preserveInput) this.subfolder.value = this.settings.destination.subfolder;
    const validation = subfolderActive ? validateSubfolder(this.subfolder.value) : { ok: true };
    this.subfolder.setAttribute("aria-invalid", String(!validation.ok));
    this.subfolderError.textContent = validation.ok ? "" : validation.error;
    this.subfolderError.hidden = validation.ok;
    this.duplicate.value = this.settings.duplicateHandling;
    this.duplicateHelp.textContent = duplicateHandlingHelp(this.settings.duplicateHandling);
    this.concurrency.forEach((input) => { input.checked = String(this.settings.concurrentDownloadLimit) === input.value; });
    if (customCategories) this.customCategoriesView.render(customCategories);
  }
}
