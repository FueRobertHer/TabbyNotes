import React, { useEffect, useState } from "react";
import useSelectedState from "./useSelectedState";
import useActions from "./useActions";
import ClickOutside from "./ClickOutside"
import { ReactComponent as SettingsIcon } from "./settings_icon.svg"

const NEW_LINE = '\n';
const TITLE_CONTENT_DIVIDER = NEW_LINE + '______' + NEW_LINE;
const DIVIDER = '~~~~~~~~~~~~~~~~~~~~' + NEW_LINE + '~~~~~~~~~~~~~~~~~~~~' + NEW_LINE;
const CONTENT_DIVIDER = NEW_LINE + NEW_LINE + DIVIDER + NEW_LINE + NEW_LINE;
const MAX_HEIGHT = 580;
const MIN_HEIGHT = 150;
const MAX_WIDTH = 780;
const MIN_WIDTH = 250;

function Settings() {
  const { addTab } = useActions();
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  function expandSettings() {
    setIsSettingsExpanded(true);
  }

  function collapseSettings() {
    setIsSettingsExpanded(false);
  }

  function toggleExpandedSettings() {
    isSettingsExpanded ? collapseSettings() : expandSettings();
  }

  function openSettings() {
    setIsSettingsVisible(true);
  }

  function closeSettings() {
    setIsSettingsVisible(false);
    collapseSettings();
  }

  function toggleSettings() {
    isSettingsVisible ? closeSettings() : openSettings();
  }

  function closeSettingsDecorator(func) {
    func();
    closeSettings();
  }

  return (
    <ClickOutside onClickOutside={closeSettings}>
      <div className="settings-container">
        <button className="tab new-tab" onClick={toggleSettings}>
          <SettingsIcon />
        </button>
        {isSettingsVisible && (
          <div className="settings-dropdown">
            <button onClick={() => closeSettingsDecorator(addTab)}>
              New tab
            </button>
            <button className="show-more" onClick={toggleExpandedSettings}>
              {isSettingsExpanded ? 'Show less' : 'Show more'}
            </button>
            {isSettingsExpanded && (
              <AdditionalSettings closeSettingsDecorator={closeSettingsDecorator} />
            )}
          </div>
        )}
      </div>
    </ClickOutside>
  )
}

function AdditionalSettings({ closeSettingsDecorator }) {
  const { tabs, height, width } = useSelectedState();
  const { resetTabs, setHeight, setWidth, resetSettings } = useActions();

  useEffect(() => {
    let boundedHeight = height;
    if (boundedHeight < MIN_HEIGHT) boundedHeight = MIN_HEIGHT;
    if (boundedHeight > MAX_HEIGHT) boundedHeight = MAX_HEIGHT;
    if (boundedHeight !== height) setHeight(boundedHeight);

    let boundedWidth = width;
    if (boundedWidth < MIN_WIDTH) boundedWidth = MIN_WIDTH;
    if (boundedWidth > MAX_WIDTH) boundedWidth = MAX_WIDTH;
    if (boundedWidth !== width) setWidth(boundedWidth);
  }, [height, setHeight, width, setWidth]);

  function onHeightChange(e) {
    setHeight(e.target.value);
  }

  function onWidthChange(e) {
    setWidth(e.target.value)
  }

  function convertTabsToStringContent() {
    const tabContents = tabs.map(tab => 
      'Title: ' + tab.title + TITLE_CONTENT_DIVIDER + tab.text + NEW_LINE
    )
    return tabContents.join(CONTENT_DIVIDER);
  }

  function downloadNotes() {
    const aTag = document.createElement("a");
    const content = convertTabsToStringContent();
    const file = new Blob([content], { type: 'text/plain' });
    aTag.href = URL.createObjectURL(file);
    aTag.download = 'TabbyNotes';
    aTag.click();
  }

  return (
    <>
      <button onClick={downloadNotes}>Download notes</button>
      <label className="settings-label">
        Height:
        <input className="input-number" type="number" value={height} onChange={onHeightChange} />
      </label>
      <label className="settings-label">
        Width:
        <input className="input-number" type="number" value={width} onChange={onWidthChange}/>
      </label>
      <button onClick={resetSettings}>Reset settings</button>
      <button onClick={() => closeSettingsDecorator(resetTabs)}>Reset tabs</button>
    </>
  )
}

export default Settings;