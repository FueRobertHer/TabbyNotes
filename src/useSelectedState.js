import { useStateContext } from "./StateContextProvider";

function useSelectedState() {
  const { state } = useStateContext();

  const tabs = state.tabs;
  const activeTab = state.activeTab;
  const activeTabText = tabs[activeTab].text;
  const height = state.height;
  const width = state.width;
  const confirmDelete = state.confirmDelete;
  const deleteIdx = state.deleteIdx;

  function getTabTitle(idx) {
    return tabs[idx].title;
  }

  function getDeleteTabTitle() {
    if (deleteIdx < 0) return "";
    return getTabTitle(deleteIdx);
  }

  return {
    tabs,
    activeTab,
    activeTabText,
    getTabTitle,
    getDeleteTabTitle,
    height,
    width,
    confirmDelete,
    deleteIdx,
  };
}

export default useSelectedState;
