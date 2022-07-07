import { ADD_TAB, DELETE_TAB, CHANGE_TAB, UPDATE, RESET_TABS, RESET_SETTINGS, SET_HEIGHT, SET_WIDTH } from "./reducer";
import { useStateContext } from "./StateContextProvider";

function useActions() {
  const { state, dispatch } = useStateContext();

  function addTab() {
    dispatch({
      type: ADD_TAB,
    });
  }

  function updateActiveTabText(value) {
    dispatch({
      type: UPDATE,
      payload: {
        tabIdx: state.activeTab,
        text: value,
      },
    });
  }

  function updateTabTitle(tabIdx) {
    const newTitle = window.prompt(
      `Enter a new title`,
      state.tabs[tabIdx].title
    );
    if (!newTitle || newTitle.length === 0) return;

    dispatch({
      type: UPDATE,
      payload: {
        tabIdx,
        title: newTitle,
      },
    });
  }

  function changeToTab(tabIdx) {
    dispatch({
      type: CHANGE_TAB,
      payload: {
        tabIdx: tabIdx,
      },
    });
  }

  function getNextTab(tabIdx) {
    if (state.activeTab === 0) {
      return 0;
    } else if (state.activeTab !== tabIdx) {
      return state.activeTab - 1;
    } else {
      return tabIdx - 1;
    }
  }

  function deleteTab(tabIdx) {
    const nextTab = getNextTab(tabIdx);
    if (state.activeTab !== nextTab) {
      changeToTab(nextTab);
    }
    dispatch({
      type: DELETE_TAB,
      payload: {
        tabIdx,
      },
    });
  }

  function resetTab(tabIdx) {
    dispatch({
      type: UPDATE,
      payload: {
        tabIdx,
        text: "",
        title: "new",
      },
    });
  }

  function deleteOrResetTab(tabIdx) {
    if (state.tabs.length === 1 && tabIdx === 0) {
      resetTab(tabIdx);
    } else {
      deleteTab(tabIdx);
    }
  }

  function resetTabs() {
    dispatch({
      type: RESET_TABS,
    });
  }

  function resetSettings() {
    dispatch({
      type: RESET_SETTINGS,
    })
  }

  function setHeight(number) {
    if (number >= 0) {
      dispatch({
        type: SET_HEIGHT,
        payload: { height: number },
      });
    }
  }

  function setWidth(number) {
    if (number >= 0) {
      dispatch({
        type: SET_WIDTH,
        payload: { width: number },
      });
    }
  }

  return {
    addTab,
    updateActiveTabText,
    updateTabTitle,
    changeToTab,
    deleteTab,
    resetTab,
    deleteOrResetTab,
    resetTabs,
    resetSettings,
    setHeight,
    setWidth,
  };
}

export default useActions;
