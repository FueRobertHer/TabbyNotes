import { useStateContext } from "./StateContextProvider";

function useSelectedState() {
  const { state } = useStateContext();

  const tabs = state.tabs;
  const activeTab = state.activeTab;
  const activeTabText = tabs[activeTab].text;

  function getTabTitle(idx) {
    return tabs[idx].title;
  }

  return { tabs, activeTab, activeTabText, getTabTitle };
}

export default useSelectedState;
