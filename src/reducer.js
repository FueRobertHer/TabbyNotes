import { INITIAL_STATE, saveStateToLocalStorage } from "./StateContextProvider";

export const RESET_TABS = "RESET_TABS";
export const ADD_TAB = "ADD_TAB";
export const DELETE_TAB = "DELETE_TAB";
export const CHANGE_TAB = "CHANGE_TAB";
export const UPDATE = "UPDATE";
export const RESET_SETTINGS = "RESET_SETTINGS"
export const SET_HEIGHT = "SET_HEIGHT";
export const SET_WIDTH = "SET_WIDTH";

const reducer = (state, action) => {
  const { type, payload } = action;
  let newState;
  switch (type) {
    case RESET_TABS:
      newState = {
        ...INITIAL_STATE,
        height: state.height,
        width: state.width,
      }
      saveStateToLocalStorage(newState)
      return newState;

    case ADD_TAB:
      newState = {
        ...state,
        tabs: [...state.tabs, { title: "new", text: "" }],
        activeTab: state.tabs.length,
      };
      saveStateToLocalStorage(newState);
      return newState;

    case DELETE_TAB:
      newState = {
        ...state,
        tabs: state.tabs.filter((_, idx) => idx !== payload.tabIdx),
      };
      saveStateToLocalStorage(newState);
      return newState;

    case CHANGE_TAB:
      newState = {
        ...state,
        activeTab: payload.tabIdx,
      };
      saveStateToLocalStorage(newState);
      return newState;

    case UPDATE:
      const updatedTabs = [...state.tabs]
      const tabToUpdate = updatedTabs[payload.tabIdx]
      const text = payload.text !== undefined ? payload.text : tabToUpdate.text;
      const title = payload.title !== undefined ? payload.title : tabToUpdate.title;
      const updatedTab = {
        ...tabToUpdate,
        text,
        title,
      }
      updatedTabs[payload.tabIdx] = updatedTab
      newState = {
        ...state,
        tabs: updatedTabs,
      };
      saveStateToLocalStorage(newState);
      return newState;
    
    case RESET_SETTINGS:
      newState = {
        ...INITIAL_STATE,
        tabs: state.tabs,
        activeTab: state.activeTab,
      }
      saveStateToLocalStorage(newState)
      return newState;
    
    case SET_HEIGHT:
      newState = { ...state, height: payload.height };
      saveStateToLocalStorage(newState);
      return newState;
    
    case SET_WIDTH:
      newState = { ...state, width: payload.width }
      saveStateToLocalStorage(newState);
      return newState;
    
    default:
      return state;
  }
};

export default reducer;
