import React from "react";
import StateContextProvider from "./StateContextProvider";
import Tabs from "./tabs";

import "./App.css";

const TAB_SPACE = "	";

document.addEventListener("keydown", (e) => {
  const textEle = document.getElementById("text");
  if (document.activeElement === textEle && e.key === "Tab") {
    e.preventDefault();
    const start = textEle.selectionStart;
    const end = start + 1;
    textEle.setRangeText(TAB_SPACE);
    textEle.setSelectionRange(end, end);
  }
});

function App() {
  return (
    <StateContextProvider>
      <Tabs />
    </StateContextProvider>
  );
}

export default App;
