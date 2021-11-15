import { saveStateToLocalStorage } from "./StateContextProvider";

export const ADD_TAB = "ADD_TAB";
export const DELETE_TAB = "DELETE_TAB";
export const CHANGE_TAB = "CHANGE_TAB";
export const UPDATE = "UPDATE";

const reducer = (state, action) => {
  const { type, payload } = action;
  let newState;
  switch (type) {
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
      newState = {
        ...state,
        tabs: state.tabs.map((tab, idx) => {
          if (idx !== payload.tabIdx) return tab;
          return {
            ...tab,
            text: payload.text,
            title: payload.title || tab.title,
          };
        }),
      };
      saveStateToLocalStorage(newState);
      return newState;
    default:
      return state;
  }
};

export default reducer;
