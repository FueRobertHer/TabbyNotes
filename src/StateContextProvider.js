import React, { createContext, useContext, useReducer } from "react";
import reducer from "./reducer";

const SAVE_STATE = "saveState";

export const INITIAL_STATE = {
  tabs: [
    {
      title: "new",
      text: "",
    },
  ],
  activeTab: 0,
  height: 500,
  width: 250,
};

const StateContext = createContext();

export function useStateContext() {
  const context = useContext(StateContext);
  if (!context)
    throw new Error("This component isn't nested under a context provider");
  return context;
}

function StateContextProvider(props) {
  const [state, dispatch] = useReducer(reducer, loadSavedState());

  return (
    <StateContext.Provider value={{ state, dispatch }}>
      {props.children}
    </StateContext.Provider>
  );
}

export function saveStateToLocalStorage(state) {
  window.localStorage.setItem(SAVE_STATE, JSON.stringify(state));
}

function migrateToNewState(state) {
  return { ...INITIAL_STATE, ...state };
}

export function loadSavedState() {
  return migrateToNewState(JSON.parse(window.localStorage.getItem(SAVE_STATE))) || INITIAL_STATE;
}

export default StateContextProvider;
