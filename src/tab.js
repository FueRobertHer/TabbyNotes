import React from "react";
import useActions from "./useActions";
import useSelectedState from "./useSelectedState";

function Tab({ idx }) {
  const { activeTab, getTabTitle } = useSelectedState();
  const { updateTabTitle, changeToTab, deleteOrResetTab } = useActions();

  let active = "";
  if (activeTab === idx) {
    active += " tab-active";
  }

  function updateTitle(e) {
    e.preventDefault();
    updateTabTitle(idx);
  }

  function openTab(e) {
    if (e.target.className === "delete") return;
    changeToTab(idx);
  }

  return (
    <span
      className={`tab ${active}`}
      onClick={openTab}
      onAuxClick={() => deleteOrResetTab(idx)}
      onContextMenu={updateTitle}
    >
      <label id={idx}>{getTabTitle(idx)}</label>

      <DeleteButton idx={idx} />
    </span>
  );
}

function DeleteButton({ idx }) {
  const { activeTab } = useSelectedState();
  const { deleteOrResetTab } = useActions();

  if (activeTab !== idx) return null;

  return (
    <button className="delete" onClick={() => deleteOrResetTab(idx)}>
      ✖
    </button>
  );
}

export default Tab;
