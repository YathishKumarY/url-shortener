import { DEFAULT_INSTANCE, normalizeOrigin, validateKey } from "./shared.js";

const form = document.getElementById("form");
const instanceInput = document.getElementById("instance");
const keyInput = document.getElementById("apiKey");
const status = document.getElementById("status");
const createKey = document.getElementById("createKey");
const saveBtn = document.getElementById("save");

function show(message, kind) {
  status.textContent = message;
  status.className = "status " + (kind || "");
}

function updateKeyLink() {
  const origin = normalizeOrigin(instanceInput.value) || DEFAULT_INSTANCE;
  createKey.href = origin + "/dashboard/settings";
}

async function load() {
  const { instance, apiKey } = await chrome.storage.sync.get(["instance", "apiKey"]);
  instanceInput.value = instance || DEFAULT_INSTANCE;
  keyInput.value = apiKey || "";
  updateKeyLink();
}

instanceInput.addEventListener("input", updateKeyLink);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const origin = normalizeOrigin(instanceInput.value);
  const apiKey = keyInput.value.trim();
  if (!origin) return show("Enter a valid http(s) instance URL.", "error");
  if (!apiKey) return show("Enter your API key.", "error");

  saveBtn.disabled = true;
  show("Saving...");
  try {
    // Must run directly from the click/submit gesture.
    const granted = await chrome.permissions.request({ origins: [origin + "/*"] });
    if (!granted) {
      show("Host access was not granted, so the extension cannot reach that instance.", "error");
      return;
    }
    await chrome.storage.sync.set({ instance: origin, apiKey });
    instanceInput.value = origin;
    updateKeyLink();
    show("Validating key...");
    await validateKey({ instance: origin, apiKey });
    show("Saved. Connected to " + origin + ".", "ok");
  } catch (err) {
    show("Saved, but validation failed: " + (err instanceof Error ? err.message : "unknown error"), "error");
  } finally {
    saveBtn.disabled = false;
  }
});

load();
