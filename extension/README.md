# Linkly browser extension

Shorten the current tab, or any link you right-click, with your own Linkly instance. Manifest V3, plain JavaScript, no build step.

## Features

- Toolbar popup that shortens the current tab, with an optional custom alias (press Enter to submit).
- Short link is copied automatically; Copy, Open and View stats buttons; QR code preview.
- Right-click any link or page and choose "Shorten link with Linkly"; the result is copied and shown in a notification.
- Clear API errors (bad key, alias taken, rate limit). Non-http(s) pages (chrome://, about:, file:) are refused.
- Follows your system light or dark theme.

## Install (Chrome, Edge, Brave)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin the Linkly icon to the toolbar.

## Install (Firefox)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** and pick `extension/manifest.json`.

Firefox 128 or newer is required. Firefox does not run MV3 service workers; it uses the `background.scripts` entry in the manifest (Chrome ignores that key and uses `service_worker`), so the same folder works in both. Temporary add-ons are removed when Firefox restarts; for a permanent install the add-on must be signed. Change the `gecko.id` in `manifest.json` to an ID you own before signing.

## Setup

1. In the Linkly web app go to **Settings**, open the **API keys** tab and create a key (it looks like `lk_` followed by 32 characters).
2. Click the extension icon, then **Open settings** (or open the extension options).
3. Enter your instance URL (for example `https://links.example.com`) and paste the key, then **Save**.
4. Approve the browser prompt granting access to that one origin. The extension then checks the key and reports success or the error.

## Privacy

The extension only talks to the instance URL you configure, using host permission for that single origin. It has no analytics and no third-party requests. Your instance URL and API key are stored in `chrome.storage.sync` (which your browser may sync across your signed-in devices); remove them by clearing the fields or uninstalling.

## Regenerating icons

```
node extension/scripts/generate-icons.mjs
```
