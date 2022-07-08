import React from "react";
import useActions from "./useActions";
import useSelectedState from "./useSelectedState";

function Tab({ idx }) {
  const { activeTab, getTabTitle } = useSelectedState();
  const { updateTabTitle, changeToTab, deleteOrResetTab } = useActions();

  const initialTabTitle = getTabTitle(idx);

  function updateTitle(e) {
    e.preventDefault();
    updateTabTitle(idx);
  }

  function openTab(e) {
    if (e.target.className === "delete" || activeTab === idx) return;
    changeToTab(idx);
  }

  let active = "";
  if (activeTab === idx) {
    active += " tab-active";
  }

  return (
    <div
      className={`tab ${active}`}
      onClick={openTab}
      onDoubleClick={updateTitle}
      onAuxClick={() => deleteOrResetTab(idx)}
    >
      <label id={idx} className="label">
        {initialTabTitle}
      </label>

      <DeleteButton idx={idx} />
    </div>
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
