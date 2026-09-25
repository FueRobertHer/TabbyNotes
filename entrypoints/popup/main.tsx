import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import {
  focusWindow,
  openStandaloneWindowId,
  registerStandaloneWindow,
  viewMode,
} from "./extension-views";
import "./style.css";

// sidepanel.html sets data-view="sidebar" in its markup; the popup page opened
// as a standalone window is marked here.
if (new URLSearchParams(window.location.search).get("view") === "window") {
  document.documentElement.dataset.view = "window";
  registerStandaloneWindow();
}

function renderApp(): void {
  const root = document.getElementById("root");

  if (!root) {
    throw new Error("TabbyNotes could not find its root element.");
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// Clicking the toolbar button while TabbyNotes is open in its own window brings that
// window forward instead of opening a second copy in the popup. This runs before
// rendering so the popup closes without drawing anything.
const standaloneWindowId = viewMode() === "popup" ? openStandaloneWindowId() : undefined;
if (standaloneWindowId === undefined) {
  renderApp();
} else {
  focusWindow(standaloneWindowId).then(
    () => window.close(),
    // The window closed in the meantime; carry on as a normal popup.
    () => renderApp(),
  );
}
