# Huy's File Downloader

A compact Manifest V3 Chrome extension that finds supported file URLs in links on the active page and batch-downloads the categories you select. It scans only `<a href>` values in the page's top-level document; it does not inspect other page content or fetch links to determine their type.

The popup has two compact in-popup views. The **Main Download** view provides the 2×2 set of file-type selectors—PDF, Images, Docs, and Media—with live counts, download status, and a read-only **Current settings** summary. Select the gear button or **Edit settings** to open the **Configuration** view, where download destination and duplicate-filename behavior can be changed. All categories are selected by default, and the page is rescanned about once per second while the popup remains open so dynamically added links are included.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this `my-file-downloader` folder.
4. Open a normal web page, click the extension icon, select file types and a destination, then choose **Download N files**.

## Permissions

- `activeTab` — grants temporary access to the active tab after the popup is opened.
- `scripting` — injects the link scanner only after the popup is opened.
- `downloads` — starts selected downloads through the background service worker.
- `storage` — retains file-type and destination preferences locally in the browser.

The extension has no broad host permissions. It does not send data anywhere, make network requests to classify links, or inspect page content beyond link URLs.

## Supported file types

Links are classified solely from the final filename/path extension, case-insensitively. Query strings and fragments do not affect classification.

- **PDF:** `.pdf`
- **Images:** `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`
- **Docs:** `.doc`, `.docx`, `.txt`, `.rtf`, `.odt`, `.xls`, `.xlsx`, `.ppt`, `.pptx`
- **Media — audio:** `.mp3`, `.wav`, `.flac`, `.aac`, `.m4a`, `.ogg`, `.oga`, `.opus`, `.wma`
- **Media — video:** `.mp4`, `.m4v`, `.mov`, `.avi`, `.mkv`, `.webm`, `.wmv`, `.flv`, `.mpeg`, `.mpg`, `.3gp`, `.ogv`

Endpoints without a recognized filename/path extension are not included, even if they ultimately return a downloadable file. Non-HTTP(S) links are also ignored. Duplicate absolute URLs are counted once.

## Download destinations

- **Chrome default Downloads folder** starts downloads without prompting.
- **Ask me for each file** uses Chrome's Save As interface. A batch opens one separate Save As dialog per file; the popup asks for confirmation before a multi-file batch.
- **Downloads subfolder** saves into an optional nested path such as `Page Downloads/2026-08`, relative to Chrome's configured Downloads folder. Source filenames are preserved when possible and use the selected duplicate-filename behavior.

Subfolder paths are normalized to `/` separators and must remain relative to Downloads. Absolute paths, `..`, empty path segments, and invalid filename characters are rejected.

Chrome controls the actual Downloads location. This extension cannot read or set its absolute filesystem path. The location is often `~/Downloads`, but it can be changed in Chrome settings. The popup's **Open download folder** control can open Chrome's configured Downloads root; Chrome does not provide an extension API to open a specific configured subfolder.

## Duplicate filenames

The **If filename already exists** setting is stored locally and applies to every download in a batch:

- **Keep both** is the default. Chrome uses `uniquify` to create a distinct name such as `file (1).pdf`.
- **Ask me** uses `prompt`; Chrome asks only when a filename conflict occurs.
- **Replace existing** uses `overwrite` and can overwrite files with matching target names. The extension asks for confirmation before it starts an overwrite batch.

Conflict detection is handled by Chrome at download time. Chrome extensions do not have a reliable general filesystem pre-check, so the extension does not try to predict or count conflicts.

## Remembered preferences

File-type selections (PDF, Images, Docs, and Media), destination preferences, and the duplicate-filename setting are stored locally in the browser and restored whenever the popup opens, including on another tab. Invalid or missing duplicate-filename values safely use the default **Keep both** setting. Older saved file-type preferences that do not include Media safely treat Media as enabled.

## Manual test checklist

- [ ] PDF, image, document, audio, and video links show under their expected categories.
- [ ] Uppercase extensions and URLs with query strings or fragments are classified correctly.
- [ ] Duplicate links to the same absolute URL are counted once.
- [ ] Add a supported link with DevTools while the popup is open; the count updates within about a second.
- [ ] A page with no supported links shows the empty state and disables download.
- [ ] Opening the popup on `chrome://` or the Chrome Web Store shows a graceful scan error.
- [ ] Toggle categories in the 2×2 selector grid; the selected total and download label update immediately.
- [ ] Default mode starts downloads without Save As prompts.
- [ ] Ask-me mode warns about and opens one Save As dialog for each selected file.
- [ ] An empty subfolder is accepted; a valid nested subfolder is saved relative to Downloads; `reports/../private` is rejected.
- [ ] Deselect Images, close and reopen the popup, and confirm it remains off while other prior selections persist.
- [ ] The Open download folder control opens Chrome's configured Downloads root.
- [ ] With a matching filename already present, Keep both creates a unique filename and Ask me shows Chrome's conflict prompt.
- [ ] Replace existing shows its confirmation; Cancel starts no downloads and Continue starts the batch with Chrome's overwrite handling.
- [ ] Change the duplicate-filename setting, close the popup, and confirm it is restored when reopening it.
- [ ] Open Configuration with the gear button, then use Back to return to the Main Download view without losing scan counts or status.
- [ ] Change the destination or duplicate behavior in Configuration and confirm the Main view's Current settings summary updates immediately.
