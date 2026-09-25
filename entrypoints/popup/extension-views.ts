import { browser } from "wxt/browser";

/**
 * Where this page is showing: the toolbar popup, a standalone window
 * (popup.html?view=window) or the browser's side panel / sidebar
 * (sidepanel.html, which sets data-view itself).
 */
export type ViewMode = "popup" | "window" | "sidebar";

export function viewMode(): ViewMode {
  const view = document.documentElement.dataset.view;
  return view === "window" || view === "sidebar" ? view : "popup";
}

interface FirefoxSidebarAction {
  open: () => Promise<void>;
}

// Firefox's sidebar API is missing from WXT's Chrome-based types.
function firefoxSidebar(): FirefoxSidebarAction | undefined {
  return (browser as unknown as { sidebarAction?: FirefoxSidebarAction }).sidebarAction;
}

export function canOpenSidePanel(): boolean {
  return Boolean(firefoxSidebar() ?? browser.sidePanel);
}

/**
 * Opens TabbyNotes in the side panel. Both browsers only allow this during a user
 * gesture, so it must run synchronously from a click with the window ID looked up
 * beforehand (awaiting anything first would lose the gesture).
 */
export function openSidePanel(windowId: number | undefined): Promise<void> {
  const sidebar = firefoxSidebar();
  if (sidebar) return sidebar.open();
  if (browser.sidePanel && windowId !== undefined) return browser.sidePanel.open({ windowId });
  return Promise.reject(new Error("This browser has no side panel for extensions."));
}

export async function openStandaloneWindow(): Promise<void> {
  await browser.windows.create({
    url: browser.runtime.getURL("/popup.html?view=window"),
    type: "popup",
    width: 1000,
    height: 760,
  });
}

export function currentWindowId(): Promise<number | undefined> {
  return Promise.resolve()
    .then(() => browser.windows.getCurrent())
    .then((window) => window?.id);
}
