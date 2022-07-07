import React, {useState} from "react";
import ClickOutside from "./ClickOutside";
import useActions from "./useActions";
import useSelectedState from "./useSelectedState";

function Tab({ idx }) {
  const { activeTab, getTabTitle } = useSelectedState();
  const { updateTabTitle, changeToTab, deleteOrResetTab } = useActions();

  const initialTabTitle = getTabTitle(idx);
  const [tabTitle, setTabTitle] = useState(initialTabTitle); 
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  function openModal() {
    setIsModalVisible(true);
  }

  function closeModal() {
    setIsModalVisible(false);
  }

  function onTitleChange(e) {
    setTabTitle(e.target.value);
  }

  function updateTitle(e) {
    e.preventDefault();
    updateTabTitle(idx, tabTitle);
    closeModal();
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
    <>
      <dialog className="modal" open={isModalVisible}>
        <ClickOutside onClickOutside={closeModal}>
          <form>
            <label>
              <p>
                Enter a new title:
              </p>
              <input type="text" value={tabTitle} onChange={onTitleChange} />
            </label>
            <div>
              <button type="button" onClick={closeModal}>Cancel</button>
              <button type="submit" onClick={updateTitle}>Confirm</button>
            </div>
          </form>
        </ClickOutside>
      </dialog>
      <div
        className={`tab ${active}`}
        onClick={openTab}
        onAuxClick={() => deleteOrResetTab(idx)}
        onDoubleClick={openModal}
      >
        <label id={idx} className="label">
          {initialTabTitle}
        </label>

        <DeleteButton idx={idx} />
      </div>
    </>
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
