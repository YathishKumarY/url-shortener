import { getSettings, isHttpUrl, shorten } from "./shared.js";

const MENU_ID = "linkly-shorten";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Shorten link with Linkly",
      contexts: ["link", "page"],
    });
  });
});

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title,
    message,
  });
}

// Service workers have no clipboard, so run the write inside the page.
async function copyInTab(tabId, text) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (value) => {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        return false;
      }
    },
    args: [text],
  });
  return Boolean(result && result.result);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const target = info.linkUrl || info.pageUrl || (tab && tab.url) || "";

  if (!isHttpUrl(target)) {
    notify("Linkly", "Only http(s) links can be shortened.");
    return;
  }
  const settings = await getSettings();
  if (!settings) {
    notify("Linkly is not set up", "Open the extension options to add your instance URL and API key.");
    chrome.runtime.openOptionsPage();
    return;
  }

  try {
    const link = await shorten(settings, target);
    let copied = false;
    if (tab && tab.id !== undefined) {
      try {
        copied = await copyInTab(tab.id, link.shortUrl);
      } catch {
        copied = false;
      }
    }
    notify(copied ? "Short link copied" : "Short link created", copied ? link.shortUrl : `${link.shortUrl} (copy it manually)`);
  } catch (err) {
    notify("Linkly error", err instanceof Error ? err.message : "Something went wrong.");
  }
});
