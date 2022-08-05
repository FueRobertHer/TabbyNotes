import React from "react";
import useActions from "./useActions";
import Tab from "./tab";
import Settings from "./Settings"
import useSelectedState from "./useSelectedState";
import useHorizontalScroll from "./useHorizontalScroll";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

const GITHUB_LINK = "https://github.com/FueRobertHer";

function Tabs() {
  const { tabs, height, width } = useSelectedState();
  const { addTab } = useActions();
  const { ref, scrollHorizontally } = useHorizontalScroll();

  return (
    <div id="App" style={{ height: `${height}px`, width: `${width}px` }}>
      <nav className="nav" ref={ref} onWheel={scrollHorizontally}>
        <Settings />
        {tabs.map((_, idx) => (
          <Tab key={`tab-${idx}`} idx={idx} />
        ))}
        <div className="empty-space" onDoubleClick={addTab} />
      </nav>
      <TabBody />
      <Credit />
      <ConfirmDeleteModal />
    </div>
  );
}

function TabBody() {
  const { activeTabText } = useSelectedState();
  const { updateActiveTabText } = useActions();

  function onTextAreaChange(e) {
    updateActiveTabText(e.target.value);
  }

  return (
    <div className="body">
      <textarea
        id="text"
        wrap="soft"
        value={activeTabText}
        onChange={onTextAreaChange}
      />
    </div>
  )
}

function Credit() {
  return (
    <footer className="credit">
      Made with love by &nbsp;
      <a href={GITHUB_LINK} rel="noopener noreferrer" target="_blank">
        Fue Her
      </a>
    </footer>
  )
}

export default Tabs;
