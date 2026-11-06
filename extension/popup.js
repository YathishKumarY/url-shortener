import { dashboardLinkUrl, getSettings, isHttpUrl, qrUrl, shorten } from "./shared.js";

const $ = (id) => document.getElementById(id);
const setup = $("setup");
const blocked = $("blocked");
const form = $("shortenForm");
const result = $("result");
const errorEl = $("error");

let settings = null;
let tabUrl = "";
let created = null;
let qrObjectUrl = null;

function showOnly(el) {
  for (const s of [setup, blocked, form, result]) s.hidden = s !== el;
}

function showError(message) {
  errorEl.textContent = message || "";
  errorEl.hidden = !message;
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    $("copied").textContent = "Copied!";
    return true;
  } catch {
    $("copied").textContent = "Could not copy automatically. Select the link and copy it.";
    return false;
  }
}

async function loadQr(link) {
  const img = $("qr");
  img.hidden = true;
  try {
    // Fetched with the key (works even if the route becomes private).
    const res = await fetch(qrUrl(settings.instance, link), {
      headers: { Authorization: `Bearer ${settings.apiKey}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    if (qrObjectUrl) URL.revokeObjectURL(qrObjectUrl);
    qrObjectUrl = URL.createObjectURL(blob);
    img.src = qrObjectUrl;
    img.hidden = false;
  } catch {
    /* QR is a nicety; ignore failures */
  }
}

async function init() {
  settings = await getSettings();
  if (!settings) return showOnly(setup);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabUrl = (tab && tab.url) || "";
  if (!isHttpUrl(tabUrl)) {
    $("blockedMsg").textContent = "This page cannot be shortened. Only http(s) pages are supported (not chrome://, about:, or file: URLs).";
    return showOnly(blocked);
  }
  $("pageTitle").textContent = (tab && tab.title) || tabUrl;
  $("pageUrl").textContent = tabUrl;
  $("pageUrl").title = tabUrl;
  showOnly(form);
  $("alias").focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  const btn = $("shorten");
  btn.disabled = true;
  btn.textContent = "Shortening...";
  try {
    const alias = $("alias").value.trim();
    created = await shorten(settings, tabUrl, alias || undefined);
    $("shortUrl").textContent = created.shortUrl;
    $("copied").textContent = "";
    showOnly(result);
    copy(created.shortUrl);
    loadQr(created);
  } catch (err) {
    showError(err instanceof Error ? err.message : "Something went wrong.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Shorten";
  }
});

$("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
$("copy").addEventListener("click", () => created && copy(created.shortUrl));
$("open").addEventListener("click", () => created && chrome.tabs.create({ url: created.shortUrl }));
$("stats").addEventListener("click", () =>
  created && chrome.tabs.create({ url: dashboardLinkUrl(settings.instance, created) }),
);
$("another").addEventListener("click", () => {
  showError("");
  $("alias").value = "";
  showOnly(form);
  $("alias").focus();
});

init().catch((err) => showError(err instanceof Error ? err.message : "Failed to start."));
