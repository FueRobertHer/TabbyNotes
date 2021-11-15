import React, { useRef } from "react";
import useActions from "./useActions";
import Tab from "./tab";
import useSelectedState from "./useSelectedState";

const GITHUB_LINK = "https://github.com/FueRobertHer";

function Tabs() {
  const { tabs, activeTabText } = useSelectedState();
  const { addTab, updateActiveTabText } = useActions();
  const navRef = useRef(null);

  function onChange(e) {
    updateActiveTabText(e.target.value);
  }

  function scrollTabsHorizontally(e) {
    e.preventDefault();
    const scrollPosition = navRef.current.scrollLeft;
    if (e.deltaX === 0) {
      navRef.current.scrollTo({
        top: 0,
        left: scrollPosition + e.deltaY,
      });
    }
  }

  return (
    <>
      <nav className="nav" ref={navRef} onWheel={scrollTabsHorizontally}>
        {tabs.map((_, idx) => (
          <Tab key={`tab-${idx}`} idx={idx} />
        ))}
        <button className="tab new-tab" onClick={addTab}>
          +
        </button>
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
    </>
  );
}

export default Tabs;
