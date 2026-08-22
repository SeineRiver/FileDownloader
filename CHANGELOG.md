# Changelog

All notable user-facing changes are documented here. Versions before `2.0.1` are reconstructed from the repository history.

## 2.0.1 — 2026-08-22

- Added a persistent count of files successfully downloaded through the extension.
- Mirrored portable preferences, custom categories, and the download count to Chrome Sync so they can be restored after reinstalling with the same synced Chrome profile.
- Kept download destination preferences local to each computer.

## 2.0.0 — 2026-08-21

- Added detection of supported embedded media sources alongside ordinary page links.
- Added a Review downloads view for reviewing and selecting individual files before download.
- Added local URL-list copy and UTF-8 text-manifest export actions.

## 1.2.1 — 2026-08-21

- Added the per-file Review downloads workflow.

## 1.2.0 — 2026-08-21

- Added configurable concurrent-download limits: sequential, 3 recommended, 5 faster, or start all at once.
- Added a background-managed download queue with progress updates and session recovery.
- Forced Save As and filename-conflict prompts to run sequentially to avoid overlapping Chrome dialogs.

## 1.1.0 — 2026-08-21

- Added named custom file categories with extension-based matching, including compound extensions such as `.tar.gz`.
- Added create, edit, delete, validation, selection persistence, and category-specific icons for custom categories.
- Prevented built-in/custom extension conflicts so every matching link has one category.

## 1.0.2 — 2026-08-21

- Added a separate in-popup Configuration view for destination, duplicate handling, and later settings.
- Added a read-only Current settings summary to the Main Download view.
- Flattened the extension files into the repository root for simpler loading in Chrome.

## 1.0.1 — 2026-08-21

- Added persistent duplicate-filename handling: Keep both, Ask me, or Replace existing.
- Added overwrite confirmation and documentation of Chrome's download-time conflict handling.

## 1.0.0 — 2026-08-21

- Initial Manifest V3 link-downloader release.
- Added PDF, image, document, and media categories; live scanning; category selection; download destinations; and batch downloads.
- Added locally persisted built-in category selections and destination preferences.
