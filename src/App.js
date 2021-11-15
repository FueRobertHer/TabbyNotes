import React from "react";
import StateContextProvider from "./StateContextProvider";
import Tabs from "./tabs";

import "./App.css";

document.addEventListener("keydown", (e) => {
  const textEle = document.getElementById("text");
  if (document.activeElement === textEle && e.key === "Tab") {
    e.preventDefault();
    let start = textEle.selectionStart;
    let end = textEle.selectionEnd;
    let text = textEle.value;
    textEle.value = text.substr(0, start) + "	" + text.substr(end, text.length);
  }
});

function App() {
  return (
    <StateContextProvider>
      <div id="App">
        <Tabs />
      </div>
    </StateContextProvider>
  );
}

export default App;
