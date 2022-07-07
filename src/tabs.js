import React, { useRef } from "react";
import useActions from "./useActions";
import Tab from "./tab";
import Settings from "./Settings"
import useSelectedState from "./useSelectedState";

const GITHUB_LINK = "https://github.com/FueRobertHer";

function Tabs() {
  const { tabs, activeTabText, height, width } = useSelectedState();
  const { updateActiveTabText } = useActions();
  const navRef = useRef(null);

  function onChange(e) {
    updateActiveTabText(e.target.value);
  }

  function scrollTabsHorizontally(e) {
    const scrollPosition = navRef.current.scrollLeft;
    if (e.deltaX === 0) {
      navRef.current.scrollTo({
        top: 0,
        left: scrollPosition + e.deltaY,
      });
    }
  }

  return (
    <div id="App" style={{height: `${height}px`, width: `${width}px`}} >
      <nav className="nav" ref={navRef} onWheel={scrollTabsHorizontally}>
        <Settings />
        
        {tabs.map((_, idx) => (
          <Tab key={`tab-${idx}`} idx={idx} />
        ))}
      </nav>

      <div className="body">
        <textarea
          id="text"
          wrap="soft"
          value={activeTabText}
          onChange={onChange}
        />
      </div>

      <footer className="credit">
        Made with love by &nbsp;
        <a href={GITHUB_LINK} rel="noopener noreferrer" target="_blank">
          Fue Her
        </a>
      </footer>
    </div>
  );
}

export default Tabs;
