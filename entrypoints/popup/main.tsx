import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./style.css";

// sidepanel.html sets data-view="sidebar" in its markup; the popup page opened
// as a standalone window is marked here.
if (new URLSearchParams(window.location.search).get("view") === "window") {
  document.documentElement.dataset.view = "window";
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("TabbyNotes could not find its root element.");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
