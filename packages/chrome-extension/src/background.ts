import type { ChromeMessage, ChromeTab } from "./chrome";

function canRunOnTab(tab: ChromeTab): tab is ChromeTab & { id: number } {
  if (typeof tab.id !== "number") return false;
  if (!tab.url) return true;
  return /^(https?|file):/.test(tab.url);
}

async function sendToggle(tabId: number, message: ChromeMessage) {
  try {
    await chrome?.tabs.sendMessage(tabId, message);
  } catch {
    await chrome?.scripting.executeScript({
      target: { tabId },
      files: ["content.global.js"],
    });
    await chrome?.tabs.sendMessage(tabId, message);
  }
}

chrome?.action.onClicked.addListener(async (tab) => {
  if (!canRunOnTab(tab)) return;
  await sendToggle(tab.id, { type: "TUNA_TOGGLE_OVERLAY" });
});
