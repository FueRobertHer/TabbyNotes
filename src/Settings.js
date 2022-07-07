import React, { useState } from "react";
import useSelectedState from "./useSelectedState";
import useActions from "./useActions";
import ClickOutside from "./ClickOutside"
import { ReactComponent as SettingsIcon } from "./settings_icon.svg"

const NEW_LINE = '\n';
const TITLE_CONTENT_DIVIDER = NEW_LINE + '______' + NEW_LINE;
const DIVIDER = '~~~~~~~~~~~~~~~~~~~~' + NEW_LINE + '~~~~~~~~~~~~~~~~~~~~' + NEW_LINE;
const CONTENT_DIVIDER = NEW_LINE + NEW_LINE + DIVIDER + NEW_LINE + NEW_LINE;

function Settings() {
  const { tabs, height, width } = useSelectedState();
  const { addTab, resetTabs, setHeight, setWidth, resetSettings } = useActions();
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
    <ClickOutside onClickOutside={closeSettings}>
      <div className="settings-container">
        <button className="tab new-tab" onClick={toggleSettings}>
          <SettingsIcon />
        </button>
    
        {isSettingsVisible && (
          <div className="settings-dropdown">
            <button onClick={() => closeSettingsDecorator(addTab)}>New tab</button>
            <button className="show-more" onClick={toggleExpandedSettings}>{isSettingsExpanded ? 'Show less' : 'Show more'}</button>
            {isSettingsExpanded && (
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
            )}
          </div>
        )}
      </div>
    </ClickOutside>
  )
}

export default Settings;