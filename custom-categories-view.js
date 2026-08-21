import { MAX_CUSTOM_CATEGORIES, createCategoryId, randomCustomCategoryIcon, validateCustomCategory } from "./settings.js";

export class CustomCategoriesView {
  constructor({ onChange, onError }) {
    this.list = document.querySelector("#custom-category-list");
    this.form = document.querySelector("#custom-category-form");
    this.id = document.querySelector("#custom-category-id");
    this.name = document.querySelector("#custom-category-name");
    this.extensions = document.querySelector("#custom-category-extensions");
    this.error = document.querySelector("#custom-category-error");
    this.add = document.querySelector("#add-custom-category-button");
    this.categories = [];
    this.onChange = onChange;
    this.onError = onError;
    this.add.addEventListener("click", () => this.openForm());
    document.querySelector("#cancel-custom-category-button").addEventListener("click", () => this.closeForm());
    this.form.addEventListener("submit", (event) => { event.preventDefault(); void this.save(); });
  }

  render(categories) {
    this.categories = categories.map((category) => ({ ...category, extensions: [...category.extensions] }));
    this.list.replaceChildren();
    if (!categories.length) {
      const empty = document.createElement("p"); empty.className = "custom-category-empty"; empty.textContent = "No custom categories yet."; this.list.append(empty);
    }
    categories.forEach((category) => this.list.append(this.createCard(category)));
    this.add.disabled = categories.length >= MAX_CUSTOM_CATEGORIES;
  }

  createCard(category) {
    const card = document.createElement("article"); card.className = "custom-category-card";
    const header = document.createElement("div"); header.className = "custom-category-card-header";
    const name = document.createElement("strong"); name.textContent = category.name;
    const actions = document.createElement("div"); actions.className = "custom-category-actions";
    const edit = document.createElement("button"); edit.type = "button"; edit.className = "link-button"; edit.textContent = "Edit"; edit.addEventListener("click", () => this.openForm(category));
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "link-button"; remove.textContent = "Delete"; remove.addEventListener("click", () => void this.delete(category));
    actions.append(edit, remove); header.append(name, actions);
    const chips = document.createElement("div"); chips.className = "extension-chips"; category.extensions.forEach((extension) => { const chip = document.createElement("span"); chip.className = "extension-chip"; chip.textContent = extension; chips.append(chip); });
    card.append(header, chips); return card;
  }

  openForm(category = null) { this.form.hidden = false; this.id.value = category?.id || ""; this.name.value = category?.name || ""; this.extensions.value = category?.extensions.join(", ") || ""; this.setError(""); this.name.focus(); }
  closeForm() { this.form.hidden = true; this.form.reset(); this.setError(""); this.add.focus(); }
  setError(message) { this.error.textContent = message; this.error.hidden = !message; this.name.setAttribute("aria-invalid", String(Boolean(message))); this.extensions.setAttribute("aria-invalid", String(Boolean(message))); }
  async save() {
    const editingId = this.id.value || null;
    const validation = validateCustomCategory({ name: this.name.value, extensions: this.extensions.value }, this.categories, editingId);
    if (!validation.ok) { this.setError(validation.error); return; }
    const existing = this.categories.find((item) => item.id === editingId);
    const category = { id: editingId || createCategoryId(), icon: existing?.icon || randomCustomCategoryIcon(this.categories), ...validation.value };
    const next = editingId ? this.categories.map((item) => item.id === editingId ? category : item) : [...this.categories, category];
    try { await this.onChange(next); this.closeForm(); } catch (error) { this.onError(error); }
  }
  async delete(category) {
    if (!window.confirm(`Delete the custom category “${category.name}”?`)) return;
    try { await this.onChange(this.categories.filter((item) => item.id !== category.id)); if (this.id.value === category.id) this.closeForm(); } catch (error) { this.onError(error); }
  }
}
